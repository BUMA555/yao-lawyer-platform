import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { AnalysisResult } from "../../components/analysis-result";
import { CaseResultBoard } from "../../components/case-result-board";
import { EmptyState, PageHero, SectionCard } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { useReport } from "../../hooks/use-report";
import { buildReportText, formatRiskLevel } from "../../utils/format";

export default function ReportPage() {
  const { user } = useCurrentUser();

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { loading, report, matterSummary, sessionId, refreshReport, copyReport } = useReport(jumpToProfile);

  return (
    <View className="law-page law-page--report">
      <PageHero
        className="page-hero--report"
        eyebrow="YAO LAWYER / RESULT"
        sticker="HEALTH CHECK RESULT"
        title="结果先落地，再谈深度"
        description="参考进化史的主逻辑，这一页先给你结果卡，让你知道现在更像什么问题、最危险点在哪、接下来先做什么。"
        stats={[
          { label: "最近会话", value: sessionId ? "已连接" : "未连接" },
          { label: "账号状态", value: user ? "已登录" : "待登录" },
          { label: "结果形态", value: "可复制结果卡" }
        ]}
        footer={<Text className="page-hero__tip">这一页优先读取最近一次咨询结果，再决定要不要去邀请页解锁或付费升级。</Text>}
        aside={
          <View className="score-spotlight">
            <Text className="score-spotlight__tag">{sessionId ? "RESULT READY" : "NO RESULT"}</Text>
            <View className="score-spotlight__disc">
              <Text className="score-spotlight__label">风险状态</Text>
              <Text className="score-spotlight__value">{report ? formatRiskLevel(report.risk_level) : "待生成"}</Text>
            </View>
            <Text className="score-spotlight__note">
              {report ? "先看核心结论和证据缺口，再决定要不要进深度版。" : "回首页完成一次案件体检，这里才会真正亮起来。"}
            </Text>
          </View>
        }
      />

      <SectionCard title="结果卡刷新" description="会话还在，就直接刷新结果；会话没了，就先回首页重新体检。" tag="ACTION">
        <View className="button-row">
          <Button className="action-button action-button--primary" loading={loading} onClick={refreshReport}>
            刷新结果卡
          </Button>
          <Button className="action-button action-button--secondary" onClick={copyReport}>
            复制完整结果
          </Button>
          <Button className="action-button action-button--ghost" onClick={() => void Taro.switchTab({ url: "/pages/orders/index" })}>
            去邀请 / 解锁
          </Button>
        </View>

        <Text className="subtle-note">
          {matterSummary ? `最近案件摘要：${matterSummary.slice(0, 80)}${matterSummary.length > 80 ? "..." : ""}` : "最近还没有能拿来压缩的案件摘要。"}
        </Text>
      </SectionCard>

      {report ? (
        <>
          <SectionCard title="体检结果卡" description="当前判断、风险等级、危险点、证据缺口和 48 小时动作，先把这些看明白。" tag="RESULT">
            <CaseResultBoard report={report} />
          </SectionCard>

          <SectionCard title="深度视角预览" description="如果你准备继续推进，再看法官版、客户版和团队版这些更深一层的表达。" tag="DEEP">
            <AnalysisResult result={report} />
          </SectionCard>

          <SectionCard title="整段复制，直接发" description="发给客户、家人、同事或群里，这一块就是结果卡的完整版。" tag="COPY">
            <Text className="preformatted-text">{buildReportText(report)}</Text>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="还没结果可看" description="先去首页完成一次案件体检，这里才会出现真正的结果卡。" tag="WAIT">
          <EmptyState
            title="现在没有可生成的结果"
            description="先从热门场景进体检，把真实案情填进去，拿到第一版结果后再回来继续。"
            action={
              <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/consult/index" })}>
                去首页开始
              </Button>
            }
          />
        </SectionCard>
      )}
    </View>
  );
}
