import { View, Text, Button } from "@tarojs/components";
import Taro, { useShareAppMessage, useShareTimeline } from "@tarojs/taro";
import { useState } from "react";

import { Badge, EmptyState, PageHero, SectionCard, StitchTopBar } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { usePlans } from "../../hooks/use-plans";
import { apiPost, getLastConsultResult } from "../../services/api";
import type { ClaimRewardResponse } from "../../types/api";
import {
  formatCurrency,
  formatRiskLevel,
  getPlanPresentation,
  getQuotaSummary,
  getQuotaTotal
} from "../../utils/format";
import { showErrorToast, showToast } from "../../utils/feedback";

const GROWTH_TASKS = [
  {
    title: "发出去",
    reward: "传播动作",
    detail: "复制专属文案和邀请码，发到微信群、朋友圈、短视频评论或主页入口。"
  },
  {
    title: "识别到",
    reward: "系统归因",
    detail: "新用户用你的邀请码绑定账号，系统记录邀请关系，复制文案本身不发算力。"
  },
  {
    title: "真转化",
    reward: "+15 算力/人",
    detail: "被邀请人完成首单后，后台生成待领取奖励，点领取才入账。"
  }
] as const;

const MARKET_PROOF_POINTS = [
  {
    value: "3748.6万件",
    label: "2025 全国法院受理审判执行案件",
    note: "每年千万级真实纠纷，才是法律 AI 要吃透的难度。"
  },
  {
    value: "1097.9万份",
    label: "2025 上网公布裁判文书",
    note: "不是背几条法条，而是持续读判例、读裁判逻辑。"
  },
  {
    value: "5300+案例",
    label: "人民法院案例库入库案例",
    note: "用权威案例校准同案同判、类案检索和裁判尺度。"
  },
  {
    value: "89万+条",
    label: "法答网答疑沉淀",
    note: "把一线法律问题转成可蒸馏、可复核的知识链条。"
  }
] as const;

const PAIN_POINTS = [
  {
    title: "不知道有没有胜算",
    detail: "普通人最怕的不是输，而是花了钱、跑了路，才发现证据和请求方向一开始就歪了。"
  },
  {
    title: "证据一堆但不会用",
    detail: "聊天记录、转账、合同、录音都有，真正进入诉讼时却缺少证明目的、时间线和证据链。"
  },
  {
    title: "文书不会写",
    detail: "诉状、答辩、调解方案写得散，法院和对方都抓不到争议焦点，成本被拖长。"
  },
  {
    title: "怕 AI 一本正经胡说",
    detail: "法律问题不能只靠话术，必须把案由、法条、类案、风险和下一步动作拆开校验。"
  }
] as const;

const MODEL_CAPABILITIES = [
  {
    label: "全球顶格模型底座",
    value: "以 GPT-5.5、Claude Opus 4.7 级别的强推理能力路线做底座，把贵的算力优先砸在复杂法律判断上。"
  },
  {
    label: "深耕律师大模型",
    value: "把公开司法数据口径、法规司法解释、裁判文书、权威案例和律师实务文档持续纳入素材池，不间断蒸馏。"
  },
  {
    label: "律师实务校准",
    value: "按真实办案流程拆解：先问事实，再抓证据缺口，再匹配类案规则，最后给 48 小时行动方案。"
  },
  {
    label: "算力资产账户",
    value: "算力用于高阶模型调用、深度分析、材料识别和结果卡生成，越复杂的问题越需要算力支撑。"
  }
] as const;

const DISTILLATION_STEPS = ["公开/授权法律数据", "案由与证据标注", "律师实务校准", "大模型不间断蒸馏", "结果卡复核输出"] as const;

const SHARE_COPY_TEMPLATES = [
  {
    tag: "欠款纠纷",
    title: "借钱不还、货款拖着不给，先问姚律师。",
    body: "限时 3 天免费做初步梳理：欠了多少、证据够不够、先催还是先起诉，一次问清楚。"
  },
  {
    tag: "婚姻家事",
    title: "离婚、财产、抚养、债务，不知道怎么开口的先问姚律师。",
    body: "免费帮你先把诉求、证据和风险拆开，别在情绪里乱签协议。"
  },
  {
    tag: "劳务劳动",
    title: "被辞退、拖工资、没签合同，别先吵，先问姚律师。",
    body: "限时免费梳理工资、考勤、聊天记录和赔偿方向，看看仲裁前还差什么。"
  },
  {
    tag: "合同纠纷",
    title: "合同违约、尾款不结、合作翻脸，先问姚律师。",
    body: "免费初筛合同风险：谁违约、证据怎么排、损失怎么说，先把方向捋清楚。"
  },
  {
    tag: "公司合伙",
    title: "合伙翻脸、股权扯皮、客户欠款，先别凭感觉硬刚。",
    body: "姚律师免费帮你先拆协议、付款、责任边界和谈判筹码，案源经验多，问得更接近实务。"
  },
  {
    tag: "证据缺口",
    title: "有理不一定有用，关键是证据能不能串起来。",
    body: "欠款、婚姻、劳动、合同纠纷，都可以先让姚律师免费查一遍证据缺口。"
  },
  {
    tag: "限时体验",
    title: "有纠纷别拖，姚律师限时 3 天免费帮你先看方向。",
    body: "欠钱、婚姻、劳务、合同、公司纠纷都能问，先把问题说清楚，再决定下一步。"
  },
  {
    tag: "普通人入口",
    title: "不知道该不该找律师？先问姚律师。",
    body: "免费把你的纠纷拆成案情、证据、风险和下一步，不用一上来就花钱咨询。"
  },
  {
    tag: "诉前判断",
    title: "不是每个纠纷都要打官司，但每个纠纷都该先看风险。",
    body: "姚律师先帮你免费判断：能不能谈、证据够不够、要不要仲裁/起诉。"
  },
  {
    tag: "深耕模型",
    title: "法律问题别只搜答案，直接问姚律师。",
    body: "深耕律师大模型，公开案例、裁判文书、律师实务持续蒸馏，先免费帮你把纠纷拆清楚。"
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
  const { user, saveUser } = useCurrentUser();
  const lastResult = getLastConsultResult();
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [claimingShareReward, setClaimingShareReward] = useState(false);
  const [shareTemplateIndex, setShareTemplateIndex] = useState(0);
  const availableCredits = user ? getQuotaTotal(user) : 0;
  const inviteCode = user?.invite_code || "登录后生成";
  const riskLabel = lastResult ? formatRiskLevel(lastResult.risk_level) : "暂无结果";
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

  const { plans, loading, busyCode, buyPlan } = usePlans(jumpToProfile);

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
    <View className="law-page law-page--credits">
      <StitchTopBar active="MODEL POWER LEDGER" action="算力资产" />

      <PageHero
        className="page-hero--credits stitch-credit-hero"
        eyebrow="YAO LAWYER / TOP MODEL POWER"
        sticker="深耕律师大模型"
        title={"全国案件知识海\n算力资产盘"}
        description="法律 AI 不能只会聊天，必须啃案件、啃文书、啃法规、啃律师实务。我们把 GPT-5.5、Claude Opus 4.7 级别的顶格推理能力路线，叠加深耕律师大模型的法律数据池和不间断蒸馏，打磨成可持续调用的法律算力。你买的不是次数，是更深的分析、更稳的证据判断和更快的行动方案。"
        stats={[
          { label: "算力余额", value: user ? `${availableCredits}` : "待登录", note: "结果卡与深度能力消耗" },
          { label: "案件口径", value: "3748.6万", note: "2025 全国法院受理案件" },
          { label: "最近风险", value: riskLabel, note: "来自最近一次咨询结果" },
          { label: "裂变码", value: inviteCode, note: "真实绑定后才可计奖" }
        ]}
        footer={<Text className="page-hero__tip">{getQuotaSummary(user)}</Text>}
        aside={
          <View className="credit-meter">
            <Text className="credit-meter__label">POWER LEDGER</Text>
            <Text className="credit-meter__value">{user ? availableCredits : "--"}</Text>
            <Text className="credit-meter__note">{user ? "驱动类案检索、深度分析、材料识别和文书骨架" : "登录后查看算力资产"}</Text>
            <Text className="credit-meter__boom">TOP MODEL</Text>
          </View>
        }
      />

      <SectionCard title="深耕法律数据池" description="全国案件不是口号，是模型必须长期消化的知识海。公开司法数据、权威案例、法律文档和律师实务会被持续清洗、标注、蒸馏，最后变成你能看懂的结果卡。" tag="DATA" className="stitch-data-card">
        <View className="data-proof-grid">
          {MARKET_PROOF_POINTS.map((item) => (
            <View key={item.label} className="data-proof-card">
              <Text className="data-proof-card__value">{item.value}</Text>
              <Text className="data-proof-card__label">{item.label}</Text>
              <Text className="data-proof-card__note">{item.note}</Text>
            </View>
          ))}
        </View>
        <View className="distill-lane">
          {DISTILLATION_STEPS.map((item, index) => (
            <View key={item} className="distill-step">
              <Text className="distill-step__index">{String(index + 1).padStart(2, "0")}</Text>
              <Text className="distill-step__label">{item}</Text>
            </View>
          ))}
        </View>
        <Text className="data-proof-source">数据口径参考最高人民法院公开工作报告与司法审判数据；训练素材以公开、授权、自有资料为边界。</Text>
      </SectionCard>

      <SectionCard title="痛点不是闲聊能解决" description="用户真正要的不是一句“建议咨询律师”，而是先把自己卡在哪里看清楚：胜算、证据、文书、风险和下一步动作。" tag="PAIN" className="stitch-pain-card">
        <View className="pain-grid">
          {PAIN_POINTS.map((item) => (
            <View key={item.title} className="pain-card">
              <Text className="pain-card__title">{item.title}</Text>
              <Text className="pain-card__detail">{item.detail}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="为什么算力值钱" description="算力不是装饰数字，而是顶级模型调用、法律语料训练、实务校准和深度功能的统一权益账户。" tag="POWER" className="stitch-rule-card stitch-power-card">
        <View className="feature-grid">
          {MODEL_CAPABILITIES.map((item) => (
            <View key={item.label} className="mini-panel">
              <Text className="mini-panel__label">{item.label}</Text>
              <Text className="mini-panel__value">{item.value}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="裂变分享赚算力" description="可以大胆传播，但不能白嫖算力：复制和发布只是第一步，系统只按邀请码绑定、首单转化和后台奖励记录发放算力。" tag="GROWTH" className="stitch-growth-card">
        <View className="growth-task-grid">
          {GROWTH_TASKS.map((item) => (
            <View key={item.title} className="growth-task-card">
              <View>
                <Text className="growth-task-card__title">{item.title}</Text>
                <Text className="growth-task-card__detail">{item.detail}</Text>
              </View>
              <Badge label={item.reward} tone="success" />
            </View>
          ))}
        </View>

        <View className="share-ledger">
          <View className="share-ledger__item">
            <Text className="share-ledger__label">当前识别</Text>
            <Text className="share-ledger__value">{SHARE_STATUS_LABELS[shareStatus]}</Text>
          </View>
          <View className="share-ledger__item">
            <Text className="share-ledger__label">发奖口径</Text>
            <Text className="share-ledger__value">绑定 + 首单</Text>
          </View>
          <View className="share-ledger__item">
            <Text className="share-ledger__label">奖励归属</Text>
            <Text className="share-ledger__value">后台记录为准</Text>
          </View>
        </View>

        <View className="claim-panel">
          <Text className="claim-panel__title">朋友圈分享语</Text>
          <Text className="claim-panel__tag">{shareTemplate.tag} · 已带咨询入口</Text>
          <Text className="claim-panel__body">{shareCopy}</Text>
          <View className="button-row">
            <Button className="action-button action-button--secondary" onClick={copyShareCopy}>
              复制分享文案
            </Button>
            <Button className="action-button action-button--ghost" onClick={randomizeShareTemplate}>
              换一条文案
            </Button>
            <Button className="action-button action-button--ghost" onClick={copyInviteCode}>
              复制邀请码
            </Button>
            <Button className="action-button action-button--primary" loading={claimingShareReward} onClick={claimShareReward}>
              识别并领取算力
            </Button>
          </View>
          <Text className="claim-panel__fineprint">规则：只复制、不绑定、不付费，不生成奖励；被邀请人继续生成内容时消耗自己的算力，不消耗你的账户。</Text>
        </View>
      </SectionCard>

      {loading ? (
        <SectionCard title="算力方案加载中" description="正在读取后端商品配置。" tag="PLANS">
          <EmptyState title="正在读取方案" description="如果持续为空，请检查后端服务和商品初始化。" />
        </SectionCard>
      ) : plans.length ? (
        <SectionCard title="月付与算力包" description="9.9 月付做低门槛入口，算力包承接高频追问、深度分析和材料识别；算力越足，越能调用更重的模型能力。" tag="PLANS" tone="muted" className="stitch-plan-section">
          <View className="plan-grid">
            {plans.map((plan) => {
              const presentation = getPlanPresentation(plan);

              return (
                <View key={plan.code} className={`plan-card ${presentation.featured ? "plan-card--featured" : ""}`}>
                  <View className="plan-card__top">
                    <View>
                      <Text className="plan-card__badge">{presentation.badge}</Text>
                      <Text className="plan-card__title">{presentation.title}</Text>
                    </View>
                    <Text className="plan-card__price">{formatCurrency(plan.price_cents)}</Text>
                  </View>

                  <Text className="plan-card__description">{presentation.description}</Text>
                  <Text className="plan-card__meta">
                    {plan.chat_credits} 点算力
                    {plan.membership_days > 0 ? ` · ${plan.membership_days} 天有效` : " · 按量使用"}
                  </Text>

                  <View className="feature-grid">
                    <View className="mini-panel">
                      <Text className="mini-panel__label">适合场景</Text>
                      <Text className="mini-panel__value">{presentation.featureA}</Text>
                    </View>
                    <View className="mini-panel">
                      <Text className="mini-panel__label">方案特征</Text>
                      <Text className="mini-panel__value">{presentation.featureB}</Text>
                    </View>
                    <View className="mini-panel">
                      <Text className="mini-panel__label">使用建议</Text>
                      <Text className="mini-panel__value">{presentation.featureC}</Text>
                    </View>
                  </View>

                  <View className="button-row">
                    <Button className="action-button action-button--primary" loading={busyCode === plan.code} onClick={() => buyPlan(plan.code)}>
                      {user ? "开通算力" : "登录后开通"}
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
        </SectionCard>
      ) : (
        <SectionCard title="暂无算力方案" description="后端尚未返回商品数据。" tag="PLANS">
          <EmptyState title="没有读取到算力方案" description="检查后端服务和套餐初始化是否完成。" />
        </SectionCard>
      )}
    </View>
  );
}
