import { View, Text, Textarea, Button, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { CaseResultBoard } from "../../../components/case-result-board";
import { PageHero, SectionCard } from "../../../components/ui";
import { useConsultation } from "../../../hooks/use-consultation";
import { useCurrentUser } from "../../../hooks/use-current-user";
import type { CaseUrgency } from "../../../types/api";
import { HOME_SCENARIOS } from "../../../utils/format";

type ValueEvent = {
  detail: {
    value: string;
  };
};

const URGENCY_OPTIONS: Array<{ value: CaseUrgency; label: string; hint: string }> = [
  { value: "low", label: "低", hint: "可按周推进" },
  { value: "normal", label: "中", hint: "建议48小时内推进" },
  { value: "high", label: "高", hint: "涉及关键节点" },
  { value: "critical", label: "紧急", hint: "需当天处理" }
];

export default function ConsultIntakePage() {
  const { user, isLoggedIn } = useCurrentUser();

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { draft, messagePreview, result, isSubmitting, isEscalating, submit, escalate, setDraftField, setUrgency, selectQuickPrompt } =
    useConsultation({
      user,
      onRequireLogin: jumpToProfile
    });

  const completedFields = [draft.title, draft.facts, draft.evidence, draft.goal].filter((item) => item.trim()).length;

  return (
    <View className="law-page law-page--consult">
      <PageHero
        className="page-hero--consult"
        eyebrow="STEP 2"
        sticker="STRUCTURED INTAKE"
        title="录入结构化案件草稿"
        description="至少补齐标题、事实和目标，证据与紧急度越清晰，结果卡越可执行。"
      />

      <SectionCard title="快速建案" description="点击场景可预填草稿骨架。" tag="PROMPTS">
        <View className="chip-row">
          {HOME_SCENARIOS.map((item) => (
            <View
              key={item.code}
              className="chip chip--interactive"
              onClick={() => selectQuickPrompt({ scene: item.code, title: item.title, facts: item.prompt })}
            >
              <Text className="chip__label">{item.title}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="案件字段" description="草稿实时保存在本地，切页后可继续。" tag="INPUT">
        <View className="text-panel" style={{ marginBottom: "12px" }}>
          <Text className="helper-text">案件标题</Text>
          <Input
            value={draft.title}
            onInput={(event: ValueEvent) => setDraftField("title", event.detail.value)}
            placeholder="例如：合同欠款，拟一周内立案"
            maxlength={120}
            style={{ width: "100%", marginTop: "8px", fontSize: "15px" }}
          />
        </View>

        <View className="text-panel" style={{ marginBottom: "12px" }}>
          <Text className="helper-text">关键事实</Text>
          <Textarea
            className="text-panel__input"
            value={draft.facts}
            onInput={(event: ValueEvent) => setDraftField("facts", event.detail.value)}
            placeholder="按时间线写：发生了什么、对方做了什么、你当前处境是什么。"
            maxlength={4000}
            autoHeight
          />
        </View>

        <View className="text-panel" style={{ marginBottom: "12px" }}>
          <Text className="helper-text">现有证据</Text>
          <Textarea
            className="text-panel__input"
            value={draft.evidence}
            onInput={(event: ValueEvent) => setDraftField("evidence", event.detail.value)}
            placeholder="例如：合同、转账记录、聊天记录、催告函、发票。"
            maxlength={3000}
            autoHeight
          />
        </View>

        <View className="text-panel" style={{ marginBottom: "12px" }}>
          <Text className="helper-text">目标诉求</Text>
          <Textarea
            className="text-panel__input"
            value={draft.goal}
            onInput={(event: ValueEvent) => setDraftField("goal", event.detail.value)}
            placeholder="例如：7天内完成催告并评估立案；优先追回欠款。"
            maxlength={2000}
            autoHeight
          />
        </View>

        <View className="text-panel">
          <Text className="helper-text">紧急程度</Text>
          <View className="chip-row" style={{ marginTop: "8px" }}>
            {URGENCY_OPTIONS.map((item) => (
              <View
                key={item.value}
                className={`chip chip--interactive${draft.urgency === item.value ? " chip--active" : ""}`}
                onClick={() => setUrgency(item.value)}
              >
                <Text className="chip__label">{item.label} / {item.hint}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="action-row" style={{ marginTop: "16px" }}>
          <Text className="helper-text">完成度：{completedFields}/4 字段</Text>
          <Text className="helper-text">账号状态：{isLoggedIn ? "已登录" : "待登录（提交前需登录）"}</Text>
          <Button className="action-button action-button--primary" loading={isSubmitting} onClick={submit}>
            生成结果卡
          </Button>
          {result ? (
            <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/report/index" })}>
              去结果页
            </Button>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="提交预览" description="这是发送给兼容后端的案件摘要文本。" tag="PAYLOAD">
        <Text className="preformatted-text">{messagePreview || "请先填写案件字段"}</Text>
      </SectionCard>

      {result ? (
        <SectionCard title="结果预览" description="提交后立即返回风险结果卡。" tag="PREVIEW">
          <CaseResultBoard
            report={result}
            footer={
              <View className="button-row">
                <Button className="action-button action-button--ghost" loading={isEscalating} onClick={escalate}>
                  申请人工复核
                </Button>
              </View>
            }
          />
        </SectionCard>
      ) : null}
    </View>
  );
}
