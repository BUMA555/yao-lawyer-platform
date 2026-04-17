import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { Badge, EmptyState, PageHero, SectionCard } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { usePlans } from "../../hooks/use-plans";
import { getLastConsultResult } from "../../services/api";
import { buildShareCopy, formatCurrency, getPlanPresentation, getQuotaSummary } from "../../utils/format";

export default function OrdersPage() {
  const { user } = useCurrentUser();
  const lastResult = getLastConsultResult();
  const shareCopy = buildShareCopy(lastResult);
  const inviteSteps = [
    {
      step: "01",
      title: "复制邀请码 / 保存文案",
      detail: user ? `你的当前邀请码是 ${user.invite_code}。先把它和结果感更强的分享文案一起发出去。` : "先登录后生成你的专属邀请码。"
    },
    {
      step: "02",
      title: "发到微信群或朋友圈",
      detail: "不要只甩首页，把结果卡感更强的文案一起带上，用户更容易理解价值。"
    },
    {
      step: "03",
      title: "回这里领取奖励",
      detail: "对方绑定成功以后，再回这页看解锁规则，顺手决定要不要直接升级。"
    }
  ] as const;

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { plans, loading, busyCode, buyPlan } = usePlans(jumpToProfile);

  return (
    <View className="law-page law-page--orders">
      <PageHero
        className="page-hero--orders"
        eyebrow="YAO LAWYER / INVITE + UNLOCK"
        sticker="BOOM! BIG REWARDS!"
        title="先分享裂变，再顺手升级"
        description="参考进化史里的思路，这一页不只是卖方案，而是把邀请码、分享文案、解锁规则和升级入口放到同一条承接线上。"
        stats={[
          { label: "邀请码", value: user ? user.invite_code : "待登录" },
          { label: "可升级方案", value: String(plans.length || 3) },
          { label: "账号状态", value: user ? "已登录" : "待登录" }
        ]}
        footer={<Text className="page-hero__tip">{getQuotaSummary(user)}</Text>}
        aside={
          <View className="reward-showcase">
            <Text className="reward-showcase__tag">FREE MONTH</Text>
            <View className="reward-showcase__disc">
              <Text className="reward-showcase__value">免费</Text>
              <Text className="reward-showcase__note">分享领时长</Text>
            </View>
            <Text className="reward-showcase__copy">{user ? `邀请码 ${user.invite_code}` : "先登录拿邀请码"}</Text>
          </View>
        }
      />

      <SectionCard title="当前解锁入口" description="先把分享和邀请码放到台面上，别让结果页的裂变承接断在最后一步。" tag="INVITE">
        {user ? (
          <>
            <View className="summary-grid">
              <View className="info-card">
                <Text className="info-card__label">当前邀请码</Text>
                <Text className="info-card__value">{user.invite_code}</Text>
              </View>
              <View className="info-card">
                <Text className="info-card__label">当前账号</Text>
                <Text className="info-card__value">{user.mobile}</Text>
              </View>
            </View>
            <View className="button-row">
              <Button className="action-button action-button--primary" onClick={() => void Taro.setClipboardData({ data: user.invite_code })}>
                复制邀请码
              </Button>
            </View>
          </>
        ) : (
          <EmptyState title="还没有邀请码" description="先登录，邀请码和邀请奖励才会真正挂到你的账号上。" />
        )}
      </SectionCard>

      <SectionCard title="怎么领免费时长" description="按照你第一版 UI 的海报逻辑，这里直接给步骤，不让用户自己猜。" tag="HOW TO SHARE">
        <View className="share-stage">
          <View className="share-steps">
            {inviteSteps.map((item) => (
              <View key={item.step} className="share-step">
                <Text className="share-step__index">{item.step}</Text>
                <View className="share-step__body-wrap">
                  <Text className="share-step__title">{item.title}</Text>
                  <Text className="share-step__body">{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className="claim-panel">
            <Text className="claim-panel__title">直接把这段发出去</Text>
            <Text className="claim-panel__body">{shareCopy}</Text>
            <View className="button-row">
              <Button className="action-button action-button--secondary" onClick={() => void Taro.setClipboardData({ data: shareCopy })}>
                复制分享文案
              </Button>
              {user ? (
                <Button className="action-button action-button--ghost" onClick={() => void Taro.setClipboardData({ data: user.invite_code })}>
                  复制邀请码
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="解锁规则" description="基础结果先给价值，增量内容再通过邀请和升级慢慢展开，这条逻辑是参考目录里最值得用的地方。" tag="UNLOCK">
        <View className="feature-grid">
          <View className="mini-panel">
            <Text className="mini-panel__label">邀请 1 人</Text>
            <Text className="mini-panel__value">解锁“对方最强反击版”，看对方可能从哪一块打你。</Text>
          </View>
          <View className="mini-panel">
            <Text className="mini-panel__label">邀请 2 人</Text>
            <Text className="mini-panel__value">解锁“法官版路径”，知道裁判视角最关心哪几刀。</Text>
          </View>
          <View className="mini-panel">
            <Text className="mini-panel__label">邀请 3 人</Text>
            <Text className="mini-panel__value">解锁文书骨架模板，再往下就可以接付费深度版。</Text>
          </View>
        </View>
      </SectionCard>

      {loading ? (
        <SectionCard title="升级方案正在冒出来" description="后端在吐配置，先等它把深度版和文书版都吐完整。" tag="UPGRADE">
          <EmptyState title="升级方案加载中" description="如果一直没结果，十有八九是后端服务还没起来。" />
        </SectionCard>
      ) : plans.length ? (
        <>
          <SectionCard title="升级解锁" description="分享能解锁一部分，但真正准备往下推进的人，还是需要深度分析和文书骨架。" tag="UPGRADE" tone="muted">
            <View className="notice-panel">
              <Text className="notice-panel__title">为什么这里还要放升级</Text>
              <Text className="notice-panel__text">
                参考目录里把裂变和付费放在同一条承接线上是对的。先分享拿结果感，再给用户一个顺手升级的入口，路径更顺。
              </Text>
            </View>
          </SectionCard>
          {plans.map((plan) => {
          const presentation = getPlanPresentation(plan);

          return (
            <SectionCard
              key={plan.code}
              title={presentation.title}
              description={presentation.description}
              tone={presentation.featured ? "accent" : "default"}
              extra={<Badge label={presentation.badge} tone={presentation.featured ? "accent" : "neutral"} />}
            >
              <View className={`plan-card ${presentation.featured ? "plan-card--featured" : ""}`}>
                <View className="plan-card__top">
                  <View>
                    <Text className="plan-card__badge">{presentation.badge}</Text>
                    <Text className="plan-card__title">{presentation.title}</Text>
                  </View>
                  <Text className="plan-card__price">{formatCurrency(plan.price_cents)}</Text>
                </View>

                <Text className="plan-card__description">{presentation.description}</Text>
                <Text className="plan-card__meta">
                  {plan.chat_credits} 次咨询额度
                  {plan.membership_days > 0 ? ` · ${plan.membership_days} 天会籍` : " · 无额外会籍天数"}
                </Text>

                <View className="feature-grid">
                  <View className="mini-panel">
                    <Text className="mini-panel__label">使用场景</Text>
                    <Text className="mini-panel__value">{presentation.featureA}</Text>
                  </View>
                  <View className="mini-panel">
                    <Text className="mini-panel__label">方案特征</Text>
                    <Text className="mini-panel__value">{presentation.featureB}</Text>
                  </View>
                  <View className="mini-panel">
                    <Text className="mini-panel__label">适配建议</Text>
                    <Text className="mini-panel__value">{presentation.featureC}</Text>
                  </View>
                </View>

                <View className="button-row">
                  <Button className="action-button action-button--primary" loading={busyCode === plan.code} onClick={() => buyPlan(plan.code)}>
                    {user ? "立即开通" : "登录后购买"}
                  </Button>
                </View>
              </View>
            </SectionCard>
          );
          })}
        </>
      ) : (
        <SectionCard title="现在没可升级的货" description="后端还没把套餐数据交出来。" tag="UPGRADE">
          <EmptyState title="没有读到升级方案" description="检查一下后端服务和数据库初始化是不是已经跑完。" />
        </SectionCard>
      )}

      <SectionCard title="先用模拟支付，不丢人" description="先把分享、解锁、升级和支付链路跑顺，再接真支付，比先死磕渠道靠谱得多。" tag="PAYMENT">
        <View className="notice-panel">
          <Text className="notice-panel__title">为什么先留模拟链路</Text>
          <Text className="notice-panel__text">
            现在最关键的是先把登录、咨询、汇报、下单和回调全部跑顺。前面不顺，后面接真支付只会更吵。
          </Text>
        </View>
      </SectionCard>
    </View>
  );
}
