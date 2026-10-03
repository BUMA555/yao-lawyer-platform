import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { CaseResultBoard } from "../../components/case-result-board";
import { Disclosure, EmptyState, SectionCard } from "../../components/ui";
import { useReport } from "../../hooks/use-report";

const URGENCY_LABELS: Record<string, string> = {
  low: "低",
  normal: "中",
  high: "高",
  critical: "紧急"
};

export default function ReportPage() {
  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { loading, draft, matterSummary, report, refreshReport } = useReport(jumpToProfile);
  const hasDraft = Boolean(draft && (draft.title.trim() || draft.facts.trim()));

  return (
    <View className="law-page law-page--report law-page--concise">
      <Text className="compact-page-title">咨询结果</Text>
      <Text className="helper-text">基于已提供的信息。重大事项请申请人工复核。</Text>

      {report ? (
        <SectionCard title="案件分析" className="stitch-result-card">
          <CaseResultBoard report={report} />
        </SectionCard>
      ) : (
        <SectionCard title="咨询结果">
          <EmptyState
            title="暂无结果"
            description="完成咨询后查看。"
            action={
              <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/consult/index" })}>
                去问姚律师
              </Button>
            }
          />
        </SectionCard>
      )}

      <SectionCard title="深度报告">
        <View className="button-row">
          <Button className="action-button action-button--primary" loading={loading} onClick={refreshReport}>
            生成深度视角
          </Button>
          <Button
            className="action-button action-button--secondary"
            disabled={!report}
            onClick={() => void Taro.navigateTo({ url: "/pages/report/deep/index" })}
          >
            查看深度报告
          </Button>
        </View>
      </SectionCard>

      <Disclosure title="原始案情">
        {hasDraft ? (
          <View className="home-next-actions">
            <View className="home-next-action">
              <Text className="home-next-action__title">案件标题</Text>
              <Text className="home-next-action__desc">{draft?.title || "未填写"}</Text>
            </View>
            <View className="home-next-action">
              <Text className="home-next-action__title">场景与紧急度</Text>
              <Text className="home-next-action__desc">
                {`${draft?.scene || "general"} / ${URGENCY_LABELS[draft?.urgency || "normal"] || draft?.urgency || "中"}`}
              </Text>
            </View>
            <View className="home-next-action">
              <Text className="home-next-action__title">目标诉求</Text>
              <Text className="home-next-action__desc">{draft?.goal || "未填写"}</Text>
            </View>
          </View>
        ) : (
          <Text className="helper-text">暂无案情。</Text>
        )}

        <View className="notice-panel" style={{ marginTop: "12px" }}>
          <Text className="notice-panel__title">案情摘要</Text>
          <Text className="preformatted-text">{matterSummary || "请先补充案件字段"}</Text>
        </View>
      </Disclosure>
    </View>
  );
}
