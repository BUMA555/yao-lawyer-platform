import Taro, { useDidShow } from "@tarojs/taro";
import { useRef, useState } from "react";

import { apiGet, apiPost, createIdempotencyKey, hasAuthToken } from "../services/api";
import type { CreateOrderResponse, OrderStatusResponse, Plan, PlanListResponse, PrepayResponse } from "../types/api";
import { showErrorToast, showToast } from "../utils/feedback";

export function usePlans(onRequireLogin: () => void, onPaymentSettled?: () => Promise<unknown>) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState("");
  const orderKeyByPlan = useRef<Record<string, string>>({});
  const buying = useRef(false);

  async function loadPlans() {
    setLoading(true);

    try {
      const response = await apiGet<PlanListResponse>("/v1/plans", false);
      setPlans(response.plans || []);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }

  useDidShow(() => {
    void loadPlans();
  });

  async function confirmPayment(orderId: string) {
    const response = await apiPost<OrderStatusResponse, Record<string, never>>(
      `/v1/orders/${orderId}/reconcile`,
      {}
    );
    if (response.status === "paid") {
      await onPaymentSettled?.();
      return true;
    }
    return false;
  }

  async function buyPlan(planCode: string) {
    if (buying.current) {
      return;
    }
    if (!hasAuthToken()) {
      showToast("请先登录账号");
      onRequireLogin();
      return;
    }

    buying.current = true;
    setBusyCode(planCode);

    try {
      const idempotencyKey =
        orderKeyByPlan.current[planCode] || createIdempotencyKey("order", `${planCode}:${Date.now()}`);
      orderKeyByPlan.current[planCode] = idempotencyKey;
      const order = await apiPost<
        CreateOrderResponse,
        { plan_code: string; channel: string; idempotency_key: string }
      >("/v1/orders/create", {
        plan_code: planCode,
        channel: "wechat",
        idempotency_key: idempotencyKey
      });

      const prepay = await apiPost<PrepayResponse, { order_id: string; open_id?: string }>("/v1/pay/wechat/prepay", {
        order_id: order.order_id,
        open_id: ""
      });

      if (order.status === "paid") {
        delete orderKeyByPlan.current[planCode];
        await onPaymentSettled?.();
        showToast("该订单已到账");
        return;
      }

      if (prepay.prepay_payload?.mode === "mock") {
        await Taro.showModal({
          title: "仅本地测试",
          content: "当前是测试支付参数，不会真实扣款。配置微信商户号和 HTTPS 回调地址后，才会拉起真实收银台。",
          showCancel: false
        });
        return;
      }

      const payload = prepay.prepay_payload as {
        timeStamp?: string;
        nonceStr?: string;
        package?: string;
        signType?: "RSA" | "MD5" | "HMAC-SHA256";
        paySign?: string;
      };

      if (!payload.timeStamp || !payload.nonceStr || !payload.package || !payload.signType || !payload.paySign) {
        throw new Error("微信支付参数不完整");
      }

      await Taro.requestPayment({
        timeStamp: payload.timeStamp,
        nonceStr: payload.nonceStr,
        package: payload.package,
        signType: payload.signType,
        paySign: payload.paySign
      });
      // Only the backend's verified transaction can confirm entitlement delivery.
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, 1200));
          }
          if (await confirmPayment(order.order_id)) {
            delete orderKeyByPlan.current[planCode];
            showToast("支付成功，算力已到账");
            return;
          }
        }
      } catch {
        // A query failure after payment does not mean the payment failed.
      }
      showToast("到账待确认，请在订单中查询");
    } catch (error) {
      showErrorToast(error);
    } finally {
      buying.current = false;
      setBusyCode("");
    }
  }

  return {
    plans,
    loading,
    busyCode,
    buyPlan,
    confirmPayment
  };
}
