import { View, Text, Button } from "@tarojs/components";
import Taro, { useShareAppMessage, useShareTimeline } from "@tarojs/taro";
import { useEffect, useState } from "react";

import { EmptyState, SectionCard } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { usePlans } from "../../hooks/use-plans";
import { apiGet, apiPost } from "../../services/api";
import type { ClaimRewardResponse, OrderListResponse, OrderRecord } from "../../types/api";
import {
  formatCurrency,
  getPlanPresentation,
  getQuotaSummary,
  getQuotaTotal
} from "../../utils/format";
import { showErrorToast, showToast } from "../../utils/feedback";

const SHARE_COPY_TEMPLATES = [
  {
    tag: "欠款纠纷",
    title: "借钱不还、货款拖着不给，先问姚律师。",
    body: "免费初筛：欠多少、证据够不够、先催还是起诉。"
  },
  {
    tag: "婚姻家事",
    title: "离婚、财产、抚养、债务，不知道怎么开口的先问姚律师。",
    body: "先拆诉求、证据和风险，别急着签协议。"
  },
  {
    tag: "劳务劳动",
    title: "被辞退、拖工资、没签合同，别先吵，先问姚律师。",
    body: "免费梳理工资、考勤和赔偿证据。"
  },
  {
    tag: "合同纠纷",
    title: "合同违约、尾款不结、合作翻脸，先问姚律师。",
    body: "免费初筛违约、证据和损失。"
  },
  {
    tag: "公司合伙",
    title: "合伙翻脸、股权扯皮、客户欠款，先别凭感觉硬刚。",
    body: "先拆协议、付款、责任和谈判筹码。"
  },
  {
    tag: "证据缺口",
    title: "有理不一定有用，关键是证据能不能串起来。",
    body: "先查欠款、婚姻、劳动、合同的证据缺口。"
  },
  {
    tag: "限时体验",
    title: "有纠纷别拖，姚律师限时 3 天免费帮你先看方向。",
    body: "欠款、婚姻、劳动、合同、公司纠纷都能问。"
  },
  {
    tag: "普通人入口",
    title: "不知道该不该找律师？先问姚律师。",
    body: "免费拆解案情、证据、风险和下一步。"
  },
  {
    tag: "诉前判断",
    title: "不是每个纠纷都要打官司，但每个纠纷都该先看风险。",
    body: "先判断能不能谈、要不要仲裁或起诉。"
  },
  {
    tag: "深耕模型",
    title: "法律问题别只搜答案，直接问姚律师。",
    body: "用律师大模型，先把纠纷拆清楚。"
  }
] as const;

const SHARE_STATUS_LABELS = {
  idle: "未复制",
  copied: "已复制，等待真实转化",
  checking: "正在识别奖励",
  claimed: "已识别并入账",
  empty: "暂无可领取奖励"
} as const;

type ShareStatus = keyof typeof SHARE_STATUS_LABELS;

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
}

export default function OrdersPage() {
  const { user, saveUser, refreshUser } = useCurrentUser();
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [claimingShareReward, setClaimingShareReward] = useState(false);
  const [shareTemplateIndex, setShareTemplateIndex] = useState(0);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [checkingOrderId, setCheckingOrderId] = useState("");
  const availableCredits = user ? getQuotaTotal(user) : 0;
  const inviteCode = user?.invite_code || "登录后生成";
  const shareTemplate = SHARE_COPY_TEMPLATES[shareTemplateIndex];
  const shareQuery = user ? `invite_code=${encodeURIComponent(user.invite_code)}` : "source=share";
  const miniProgramSharePath = `/pages/consult/index?${shareQuery}`;
  const configuredOrigin = normalizeOrigin(process.env.H5_PUBLIC_ORIGIN || "");
  const runtimeOrigin =
    process.env.TARO_ENV === "h5" && typeof window !== "undefined" ? normalizeOrigin(window.location.origin) : "";
  const publicOrigin = configuredOrigin || (runtimeOrigin && !isLocalOrigin(runtimeOrigin) ? runtimeOrigin : "");
  const h5ShareLink = publicOrigin ? `${publicOrigin}/#/pages/consult/index?${shareQuery}` : "";
  const shareEntryLines = h5ShareLink
    ? ["点这里直接问：", h5ShareLink]
    : ["点小程序分享卡片进入，朋友点开就能直接问。"];
  const shareCopy = [
    shareTemplate.title,
    "",
    shareTemplate.body,
    "",
    ...shareEntryLines,
    "",
    user ? `我的邀请码：${user.invite_code}` : "邀请码：登录后生成，真实绑定和首单后才会计奖",
    "",
    "提示：AI 初步梳理不等同正式法律意见，不承诺案件结果。"
  ].join("\n");

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    void apiGet<OrderListResponse>("/v1/orders")
      .then((response) => setOrders(response.orders || []))
      .catch(() => setOrders([]));
  }, [user]);

  useShareAppMessage(() => ({
    title: shareTemplate.title,
    path: miniProgramSharePath
  }));

  useShareTimeline(() => ({
    title: shareTemplate.title,
    query: shareQuery
  }));

  function randomizeShareTemplate() {
    if (SHARE_COPY_TEMPLATES.length <= 1) {
      return;
    }

    let nextIndex = Math.floor(Math.random() * SHARE_COPY_TEMPLATES.length);
    if (nextIndex === shareTemplateIndex) {
      nextIndex = (nextIndex + 1) % SHARE_COPY_TEMPLATES.length;
    }
    setShareTemplateIndex(nextIndex);
  }

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { plans, loading, busyCode, buyPlan, confirmPayment } = usePlans(jumpToProfile, refreshUser);

  async function checkOrder(orderId: string) {
    if (checkingOrderId) {
      return;
    }
    setCheckingOrderId(orderId);
    try {
      showToast((await confirmPayment(orderId)) ? "算力已到账" : "尚未确认付款");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setCheckingOrderId("");
    }
  }

  async function copyShareCopy() {
    await Taro.setClipboardData({ data: shareCopy });
    setShareStatus("copied");
    randomizeShareTemplate();
    showToast(user ? "已复制，下一版文案已刷新" : "已复制通用文案，登录后带邀请码可计奖");
  }

  async function copyInviteCode() {
    if (!user) {
      showToast("登录后才有邀请码，复制分享文案不会跳转");
      return;
    }

    await Taro.setClipboardData({ data: user.invite_code });
    setShareStatus("copied");
    showToast("邀请码已复制");
  }

  async function claimShareReward() {
    if (!user) {
      showToast("请先到我的页登录，再领取算力");
      return;
    }

    setClaimingShareReward(true);
    setShareStatus("checking");

    try {
      const response = await apiPost<ClaimRewardResponse, { max_claim_count: number }>("/v1/referral/reward/claim", {
        max_claim_count: 10
      });

      if (response.granted_chat_credits > 0) {
        saveUser({
          ...user,
          paid_chat_credits: user.paid_chat_credits + response.granted_chat_credits
        });
        setShareStatus("claimed");
        showToast(`已入账 ${response.granted_chat_credits} 点算力`);
        return;
      }

      setShareStatus("empty");
      showToast("暂无奖励：需新用户绑定邀请码并完成首单");
    } catch (error) {
      setShareStatus("copied");
      showErrorToast(error);
    } finally {
      setClaimingShareReward(false);
    }
  }

  return (
    <View className="law-page law-page--credits law-page--concise">
      <View className="compact-account-header">
        <Text className="compact-page-title">算力</Text>
        <View className="compact-account-balance">
          <Text className="helper-text">可用算力</Text>
          <Text className="compact-account-balance__value">{user ? availableCredits : "--"}</Text>
        </View>
      </View>
      <Text className="helper-text">{getQuotaSummary(user)}</Text>

      {loading ? (
        <SectionCard title="算力方案">
          <EmptyState title="加载中" description="请稍候。" />
        </SectionCard>
      ) : plans.length ? (
        <SectionCard title="算力方案" className="stitch-plan-section">
          <View className="plan-grid">
            {plans.map((plan) => {
              const presentation = getPlanPresentation(plan);

              return (
                <View key={plan.code} className={`plan-card ${presentation.featured ? "plan-card--featured" : ""}`}>
                  <View className="plan-card__top">
                    <Text className="plan-card__title">{presentation.title}</Text>
                    <Text className="plan-card__price">{formatCurrency(plan.price_cents)}</Text>
                  </View>
                  <Text className="plan-card__description">{presentation.description}</Text>
                  <Text className="plan-card__meta">
                    {plan.chat_credits} 点算力
                    {plan.membership_days > 0 ? ` · ${plan.membership_days} 天会员` : " · 按量使用"}
                  </Text>
                  <Button className="action-button action-button--primary" disabled={Boolean(busyCode)} loading={busyCode === plan.code} onClick={() => buyPlan(plan.code)}>
                    {user ? "开通算力" : "登录后开通"}
                  </Button>
                </View>
              );
            })}
          </View>
        </SectionCard>
      ) : (
        <SectionCard title="算力方案">
          <EmptyState title="方案暂不可用" description="请稍后再试。" />
        </SectionCard>
      )}

      <SectionCard title="邀请奖励" extra={<Text className="helper-text">{SHARE_STATUS_LABELS[shareStatus]}</Text>}>
        <View className="claim-panel">
          <Text className="claim-panel__tag">邀请码：{inviteCode}</Text>
          <Text className="claim-panel__body">{shareTemplate.title}</Text>
          <View className="button-row">
            <Button className="action-button action-button--secondary" onClick={copyShareCopy}>
              复制邀请
            </Button>
            <Button className="action-button action-button--ghost" onClick={randomizeShareTemplate}>
              换文案
            </Button>
            <Button className="action-button action-button--ghost" onClick={copyInviteCode}>
              复制邀请码
            </Button>
            <Button className="action-button action-button--primary" loading={claimingShareReward} onClick={claimShareReward}>
              领取奖励
            </Button>
          </View>
          <Text className="claim-panel__fineprint">好友绑定邀请码并完成首单后发奖。AI 咨询不承诺案件结果。</Text>
        </View>
      </SectionCard>

      {user ? (
        <SectionCard title="我的订单">
          {orders.length ? (
            <View className="summary-grid">
              {orders.slice(0, 6).map((order) => (
                <View className="info-card" key={order.id}>
                  <Text className="info-card__label">{order.plan_code}</Text>
                  <Text className="info-card__value">
                    {formatCurrency(order.amount_cents)} · {order.status === "paid" ? "已支付" : order.status === "created" ? "待支付" : order.status === "refunded" ? "已退款" : order.status}
                  </Text>
                  <Text className="info-card__note">{new Date(order.created_at).toLocaleString("zh-CN")}</Text>
                  {order.channel === "wechat" && order.status === "created" ? (
                    <Button className="action-button action-button--ghost" disabled={Boolean(checkingOrderId)} loading={checkingOrderId === order.id} onClick={() => checkOrder(order.id)}>
                      查询到账
                    </Button>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="还没有订单" description="开通方案后显示。" />
          )}
        </SectionCard>
      ) : null}

    </View>
  );
}
