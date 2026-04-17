import { View, Text, Textarea, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { CaseResultBoard } from "../../components/case-result-board";
import { Badge, EmptyState, PageHero, SectionCard } from "../../components/ui";
import { useConsultation } from "../../hooks/use-consultation";
import { useCurrentUser } from "../../hooks/use-current-user";
import { getQuotaSummary, HOME_MISTAKES, HOME_SCENARIOS } from "../../utils/format";

type ValueEvent = {
  detail: {
    value: string;
  };
};

export default function ConsultPage() {
  const { user } = useCurrentUser();

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { message, setMessage, result, isSubmitting, isEscalating, submit, escalate, selectQuickPrompt } = useConsultation({
    user,
    onRequireLogin: jumpToProfile
  });

  return (
    <View className="law-page law-page--consult">
      <PageHero
        className="page-hero--consult"
        eyebrow="YAO LAWYER / ENTRY"
        sticker="SELECT PRIMARY ISSUE"
        title="先体检，再决定要不要冲"
        description="这不是让你先陷进长对话，而是先做一次案件体检：判断问题类型、风险等级、证据缺口和 48 小时动作。"
        stats={[
          { label: "账号状态", value: user ? "已登录" : "待登录" },
          { label: "产品主线", value: "先结果卡" },
          { label: "风险机制", value: "R1-R3 分级" }
        ]}
        footer={<Text className="page-hero__tip">{getQuotaSummary(user)}</Text>}
        aside={
          <View className="hero-showcase hero-showcase--consult">
            <Text className="hero-showcase__eyebrow">STEP 1</Text>
            <Text className="hero-showcase__title">先选场景，再把事实灌进去</Text>
            <Text className="hero-showcase__body">
              {user
                ? "借钱不还、劳动纠纷、合同欠款、证据整理这些高频入口已经给你排好了，别直接从空白页硬写。"
                : "先登录，结果卡、邀请奖励和升级记录才会真正落到你的账号里。"}
            </Text>
          </View>
        }
      />

      <SectionCard
        title="先看入口，不要乱打"
        description="参考你第一版 UI 的主线，这一页先负责承接和分流，不负责一下子把所有功能全甩给用户。"
        tag="ENTRY"
      >
        {result ? (
          <View className="home-case-card">
            <Text className="home-case-card__title">继续上次案件</Text>
            <Text className="home-case-card__body">上次体检结果已经生成，可以继续看结果卡、分享解锁或申请人工复核。</Text>
            <View className="button-row">
              <Button className="action-button action-button--primary" onClick={() => void Taro.switchTab({ url: "/pages/report/index" })}>
                继续查看结果
              </Button>
            </View>
          </View>
        ) : (
          <View className="notice-panel">
            <Text className="notice-panel__title">{user ? "先从一个高频场景开始" : "你还没上号"}</Text>
            <Text className="notice-panel__text">
              {user
                ? "别一上来就自由发挥，先选一个最接近的高频场景，后面的输入负担会小很多。"
                : "不登录也能看结构，但结果、邀请和升级都不会替你留下记录。"}
            </Text>
            {!user ? (
              <View className="button-row">
                <Button className="action-button action-button--secondary" onClick={jumpToProfile}>
                  先去登录
                </Button>
              </View>
            ) : null}
          </View>
        )}
      </SectionCard>

      <SectionCard title="热门场景" description="先让用户判断自己更像哪类问题，再降低输入门槛，这才是最像你那版设计意图的入口。" tag="SCENES">
        <View className="scenario-grid">
          {HOME_SCENARIOS.map((item) => (
            <View key={item.code} className="scenario-card" onClick={() => selectQuickPrompt(item.prompt)}>
              <Text className="scenario-card__flag">{item.title.slice(0, 2)}</Text>
              <Text className="scenario-card__title">{item.title}</Text>
              <Text className="scenario-card__subtitle">{item.subtitle}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="今天最容易做错的事" description="先给风险提醒，比一上来讲法条更能拦住用户乱动作。" tag="DON'T" tone="accent">
        <View className="list-block">
          {HOME_MISTAKES.map((item, index) => (
            <View key={item} className="list-item">
              <Text className="list-item__index">{index + 1}</Text>
              <Text className="list-item__text">{item}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="开始案件体检" description="不用一次写很多，先把最关键的事实、证据和当前担心点扔进来。" tag="INTAKE">
        {user ? (
          <View className="inline-summary">
            <Badge label={`当前账号：${user.mobile}`} tone="success" />
            <Text className="helper-text">{getQuotaSummary(user)}</Text>
          </View>
        ) : null}

        <View className="chip-row" style={{ marginTop: "16px" }}>
          {HOME_SCENARIOS.map((item) => (
            <View key={item.title} className="chip chip--interactive" onClick={() => selectQuickPrompt(item.prompt)}>
              <Text className="chip__label">{item.title}</Text>
            </View>
          ))}
        </View>

        <View className="poster-note">
          <Text className="poster-note__label">最好这样写</Text>
          <Text className="poster-note__body">按时间线、证据、对方动作、你想达到的目标这 4 块写，系统给出的结果卡会更像真案情而不是闲聊。</Text>
        </View>

        <View className="text-panel">
          <Textarea
            className="text-panel__input"
            value={message}
            onInput={(event: ValueEvent) => setMessage(event.detail.value)}
            placeholder="例：2025 年 9 月签了采购合同，对方 11 月开始拖欠货款；我现在有合同、对账单、发票、催款聊天记录；尚未起诉，下周准备立案。"
            maxlength={8000}
            autoHeight
          />
        </View>

        <View className="action-row">
          <Text className="helper-text">已输入 {message.trim().length} 字。别客气，把时间线、证据、程序节点和你的目标都狠狠干进去。</Text>
          <Button className="action-button action-button--primary" loading={isSubmitting} onClick={submit}>
            开始分析
          </Button>
        </View>
      </SectionCard>

      {result ? (
        <SectionCard title="结果预览" description="这里先给你一张能立刻看懂的结果卡，完整结果和深度视角放到结果页继续承接。" tag="PREVIEW">
          <CaseResultBoard
            report={result}
            footer={
              <View className="dual-actions">
                <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/report/index" })}>
                  去结果页继续看
                </Button>
                <Button className="action-button action-button--ghost" loading={isEscalating} onClick={escalate}>
                  申请人工复核
                </Button>
              </View>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard title="结果卡会长什么样" description="不是先让你读一坨分析，而是先给你：当前判断、危险点、证据缺口和动作清单。" tag="PREVIEW">
          <EmptyState
            title="现在还没生成结果卡"
            description="从一个真实案件开始就够了。先把问题拆清，再决定要不要分享、升级或继续补材料。"
          />
        </SectionCard>
      )}
    </View>
  );
}
