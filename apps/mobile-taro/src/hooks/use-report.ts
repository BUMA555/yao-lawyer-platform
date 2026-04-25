import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";

import {
  apiPost,
  buildConsultMessageFromDraft,
  getCaseDraft,
  getChatSessionId,
  getLastConsultResult,
  hasAuthToken,
  setLastConsultResult
} from "../services/api";
import type { CaseDraft, ChatRespondPayload, ChatRespondResponse } from "../types/api";
import { showErrorToast, showToast } from "../utils/feedback";
import { buildReportText } from "../utils/format";

function resolveMatterSummary(draft: CaseDraft | null) {
  const summary = buildConsultMessageFromDraft(draft).trim();
  return summary;
}

export function useReport(onRequireLogin: () => void) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ChatRespondPayload | null>(getLastConsultResult());
  const [draft, setDraft] = useState<CaseDraft | null>(getCaseDraft());
  const [matterSummary, setMatterSummary] = useState(resolveMatterSummary(getCaseDraft()));
  const [sessionId, setSessionId] = useState(getChatSessionId());

  useDidShow(() => {
    const latestDraft = getCaseDraft();
    setReport(getLastConsultResult());
    setDraft(latestDraft);
    setMatterSummary(resolveMatterSummary(latestDraft));
    setSessionId(getChatSessionId());
  });

  async function refreshReport() {
    if (!hasAuthToken()) {
      showToast("请先登录账号");
      onRequireLogin();
      return;
    }

    if (!sessionId) {
      showToast("请先在咨询页完成一次分析");
      return;
    }

    const currentSummary = resolveMatterSummary(getCaseDraft());

    if (!currentSummary) {
      showToast("请先补充案件草稿");
      return;
    }

    setLoading(true);

    try {
      const response = await apiPost<ChatRespondResponse, { session_id: string; user_message: string; output_mode: string }>(
        "/v1/chat/respond",
        {
          session_id: sessionId,
          user_message: `请基于以下案件草稿生成汇报：\n${currentSummary}\n\n请按法官版、客户版、团队版和下一步动作输出。`,
          output_mode: "report"
        }
      );

      setReport(response.data);
      setLastConsultResult(response.data);
      showToast("汇报已刷新");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    const text = buildReportText(report);

    if (!text) {
      showToast("先生成一份汇报");
      return;
    }

    await Taro.setClipboardData({ data: text });
    showToast("汇报已复制");
  }

  return {
    loading,
    draft,
    matterSummary,
    report,
    sessionId,
    refreshReport,
    copyReport
  };
}
