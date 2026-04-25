import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { AnalysisResult } from "../../../components/analysis-result";
import { EmptyState, PageHero, SectionCard } from "../../../components/ui";
import { useCurrentUser } from "../../../hooks/use-current-user";
import { useReport } from "../../../hooks/use-report";
import { buildReportText } from "../../../utils/format";

const EVIDENCE_CHECKLIST = [
  "合同/借条/协议原件或清晰扫描件",
  "转账记录、发票、对账单",
  "聊天记录导出（含时间戳）",
  "送达、催收、通知留痕"
].join("\n");

export default function ReportDeepPage() {
  const { user } = useCurrentUser();

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const { draft, matterSummary, report, copyReport } = useReport(jumpToProfile);

  return (
    <View className="law-page law-page--report">
      <PageHero
        className="page-hero--report"
        eyebrow="STEP 4"
        sticker="DEEP REPORT"
        title="深度报告与证据承接"
        description="把结果卡转成可转发文本，并按清单准备证据材料。"
        stats={[
          { label: "账号状态", value: user ? "已登录" : "待登录" },
          { label: "案件标题", value: draft?.title || "未填写" },
          { label: "结果状态", value: report ? "可查看深度版" : "待生成" }
        ]}
      />

      {report ? (
        <>
          <SectionCard title="案件承接信息" description="深度报告沿用案件草稿，不再重复描述。" tag="CASE">
            <View className="home-next-actions">
              <View className="home-next-action">
                <Text className="home-next-action__title">场景</Text>
                <Text className="home-next-action__desc">{draft?.scene || "general"}</Text>
              </View>
              <View className="home-next-action">
                <Text className="home-next-action__title">目标诉求</Text>
                <Text className="home-next-action__desc">{draft?.goal || "未填写"}</Text>
              </View>
            </View>
            <Text className="preformatted-text" style={{ marginTop: "12px" }}>
              {matterSummary || "请先补充案件摘要"}
            </Text>
          </SectionCard>

          <SectionCard title="深度视角" description="法官版、客户版、团队版一次看全。" tag="DEEP">
            <AnalysisResult result={report} />
          </SectionCard>

          <SectionCard title="整段复制" description="一键复制，直接发给客户或团队。" tag="COPY">
            <Text className="preformatted-text">{buildReportText(report)}</Text>
            <View className="button-row" style={{ marginTop: "12px" }}>
              <Button className="action-button action-button--secondary" onClick={copyReport}>
                复制完整结果
              </Button>
            </View>
          </SectionCard>

          <SectionCard title="证据准备" description="先按清单整理，再进入上传流程。" tag="UPLOAD">
            <View className="notice-panel">
              <Text className="notice-panel__title">建议优先整理这 4 类材料</Text>
              <Text className="preformatted-text">{EVIDENCE_CHECKLIST}</Text>
            </View>
            <View className="button-row" style={{ marginTop: "12px" }}>
              <Button className="action-button action-button--secondary" onClick={() => void Taro.setClipboardData({ data: EVIDENCE_CHECKLIST })}>
                复制证据清单
              </Button>
              <Button className="action-button action-button--ghost" onClick={() => void Taro.navigateBack()}>
                返回结果页
              </Button>
            </View>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="暂无深度内容" description="先完成体检并生成结果卡。" tag="WAIT">
          <EmptyState
            title="还没有可读取的结果"
            description="先去案件入口完成场景选择和结构化录入。"
            action={
              <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/consult/index" })}>
                去案件入口
              </Button>
            }
          />
        </SectionCard>
      )}
    </View>
  );
}
