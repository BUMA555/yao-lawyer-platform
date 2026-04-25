import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { CaseResultBoard } from "../../components/case-result-board";
import { EmptyState, PageHero, SectionCard, StitchTopBar } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { useReport } from "../../hooks/use-report";
import { formatRiskLevel } from "../../utils/format";

const URGENCY_LABELS: Record<string, string> = {
  low: "低",
  normal: "中",
  high: "高",
  critical: "紧急"
};

export default function ReportPage() {
  const { user } = useCurrentUser();

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { loading, draft, matterSummary, report, sessionId, refreshReport } = useReport(jumpToProfile);
  const hasDraft = Boolean(draft && (draft.title.trim() || draft.facts.trim()));

  return (
    <View className="law-page law-page--report">
      <StitchTopBar active="TOP SECRET! 结果卡" action="深度分析" />

      <PageHero
        className="page-hero--report stitch-report-hero"
        eyebrow="YAO LAWYER / RESULT"
        sticker={report ? "RESULT READY" : "WAITING"}
        title={"深度法律\n分析报告"}
        description="这里承接最近一次提问后的结果卡：风险等级、证据缺口、48 小时动作和可解锁的深度视角。结果卡基于你提供的信息生成，重大节点建议人工复核。"
        stats={[
          { label: "会话状态", value: sessionId ? "已连接" : "未连接" },
          { label: "账号状态", value: user ? "已登录" : "待登录" },
          { label: "风险等级", value: report ? formatRiskLevel(report.risk_level) : "待生成" },
          { label: "结果状态", value: report ? "初筛完成" : "待提问" }
        ]}
        aside={
          <View className="report-risk-poster">
            <Text className="report-risk-poster__tag">风险等级</Text>
            <Text className="report-risk-poster__value">{report ? formatRiskLevel(report.risk_level) : "未生成"}</Text>
            <Text className="report-risk-poster__note">{report ? "先看证据缺口，再决定是否复核。" : "先去问姚律师，生成第一张结果卡。"}</Text>
          </View>
        }
      />

      {report ? (
        <SectionCard title="结果卡" description="姚律师给出的核心判断、证据缺口与 48 小时动作。" tag="RESULT" className="stitch-result-card">
          <CaseResultBoard report={report} />
        </SectionCard>
      ) : (
        <SectionCard title="还没结果可看" description="先去问姚律师，把问题说出来。" tag="WAIT">
          <EmptyState
            title="当前没有可展示结果"
            description="先去问姚律师，完成一次基础分析后这里会显示结果卡。"
            action={
              <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/consult/index" })}>
                去问姚律师
              </Button>
            }
          />
        </SectionCard>
      )}

      <SectionCard title="下一步" description="默认展示最近结果；需要更完整视角时再刷新深度分析。" tag="ACTION">
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

      <SectionCard title="问题摘要" description="来自你刚才向姚律师描述的问题。" tag="QUESTION">
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
          <Text className="helper-text">暂无结构化草稿，请先回案件入口建立草稿。</Text>
        )}

        <View className="notice-panel" style={{ marginTop: "12px" }}>
          <Text className="notice-panel__title">提交摘要预览</Text>
          <Text className="preformatted-text">{matterSummary || "请先补充案件字段"}</Text>
        </View>
      </SectionCard>
    </View>
  );
}
