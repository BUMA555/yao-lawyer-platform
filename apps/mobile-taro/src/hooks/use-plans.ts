import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";

import { apiGet, apiPost, hasAuthToken } from "../services/api";
import type { CreateOrderResponse, Plan, PlanListResponse, PrepayResponse } from "../types/api";
import { showErrorToast, showToast } from "../utils/feedback";

export function usePlans(onRequireLogin: () => void) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState("");

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

  async function buyPlan(planCode: string) {
    if (!hasAuthToken()) {
      showToast("请先登录账号");
      onRequireLogin();
      return;
    }

    setBusyCode(planCode);

    try {
      const order = await apiPost<CreateOrderResponse, { plan_code: string; channel: string }>("/v1/orders/create", {
        plan_code: planCode,
        channel: "wechat"
      });

      const prepay = await apiPost<PrepayResponse, { order_id: string; open_id: string }>("/v1/pay/wechat/prepay", {
        order_id: order.order_id,
        open_id: "mock_openid"
      });

      await Taro.showModal({
        title: "支付模拟已生成",
        content: JSON.stringify(prepay.prepay_payload || {}, null, 2),
        showCancel: false
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setBusyCode("");
    }
  }

  return {
    plans,
    loading,
    busyCode,
    buyPlan
  };
}
