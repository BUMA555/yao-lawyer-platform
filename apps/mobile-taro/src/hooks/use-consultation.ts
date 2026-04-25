import Taro from "@tarojs/taro";
import { useMemo, useState } from "react";

import {
  apiPatch,
  apiPost,
  buildConsultMessageFromDraft,
  createEmptyCaseDraft,
  getCurrentCaseId,
  getCaseDraft,
  getChatSessionId,
  getLastConsultResult,
  hasAuthToken,
  patchCaseDraft,
  setCurrentCaseId,
  setCaseDraft,
  setChatSessionId,
  setLastConsultResult,
  setLoginReturnTo
} from "../services/api";
import type {
  CaseDetailResponse,
  CaseDraft,
  CaseUrgency,
  ChatRespondPayload,
  ChatRespondResponse,
  CreateSessionResponse,
  EscalateHumanResponse,
  LoginUser
} from "../types/api";
import { showErrorToast, showToast } from "../utils/feedback";

interface UseConsultationOptions {
  user: LoginUser | null;
  onRequireLogin: () => void;
}

type DraftField = "scene" | "title" | "facts" | "evidence" | "goal";

function ensureDraft(input: CaseDraft | null) {
  return input || createEmptyCaseDraft();
}

function trimDraft(draft: CaseDraft): CaseDraft {
  return {
    ...draft,
    scene: draft.scene.trim(),
    title: draft.title.trim(),
    facts: draft.facts.trim(),
    evidence: draft.evidence.trim(),
    goal: draft.goal.trim()
  };
}

function hasMinimumContent(draft: CaseDraft) {
  const facts = draft.facts.trim();
  return facts.length >= 12 && draft.goal.trim().length >= 4;
}

function resolveCaseLane(scene: string) {
  if (scene === "labor" || scene === "company-control" || scene === "fraud-boundary" || scene === "civil-commercial") {
    return scene;
  }
  return "civil-commercial";
}

function resolveCasePriority(urgency: CaseUrgency) {
  return urgency === "high" || urgency === "critical" ? "high" : "normal";
}

function buildCaseSummary(draft: CaseDraft) {
  return buildConsultMessageFromDraft(draft).slice(0, 4000);
}

export function useConsultation({ user, onRequireLogin }: UseConsultationOptions) {
  const [draft, setDraftState] = useState<CaseDraft>(() => ensureDraft(getCaseDraft()));
  const [result, setResult] = useState<ChatRespondPayload | null>(getLastConsultResult());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  const messagePreview = useMemo(() => buildConsultMessageFromDraft(draft), [draft]);

  function updateDraft(patch: Partial<CaseDraft>) {
    const next = patchCaseDraft(patch);
    setDraftState(next);
  }

  function setDraftField(field: DraftField, value: string) {
    updateDraft({ [field]: value } as Pick<CaseDraft, DraftField>);
  }

  function setUrgency(urgency: CaseUrgency) {
    updateDraft({ urgency });
  }

  function selectQuickPrompt(payload: {
    scene: string;
    title: string;
    facts: string;
    evidence?: string;
    goal?: string;
    urgency?: CaseUrgency;
  }) {
    const current = trimDraft(draft);
    const nextPatch: Partial<CaseDraft> = {
      scene: payload.scene,
      title: payload.title,
      facts: payload.facts,
      evidence: payload.evidence ?? current.evidence,
      goal: payload.goal ?? current.goal,
      urgency: payload.urgency ?? current.urgency
    };

    updateDraft(nextPatch);
  }

  async function ensureCaseId(preparedDraft: CaseDraft) {
    const currentCaseId = getCurrentCaseId();
    const payload = {
      title: preparedDraft.title || preparedDraft.facts.slice(0, 40) || "案件草稿",
      summary: buildCaseSummary(preparedDraft),
      lane: resolveCaseLane(preparedDraft.scene),
      priority: resolveCasePriority(preparedDraft.urgency)
    };

    if (currentCaseId) {
      const updated = await apiPatch<CaseDetailResponse, typeof payload>(`/v1/cases/${currentCaseId}`, payload);
      setCurrentCaseId(updated.case.id);
      return updated.case.id;
    }

    const created = await apiPost<CaseDetailResponse, typeof payload>("/v1/cases", payload);
    setCurrentCaseId(created.case.id);
    return created.case.id;
  }

  async function ensureSessionId(summary: string, caseId: string, scene: string) {
    const existing = getChatSessionId();

    if (existing) {
      return existing;
    }

    const created = await apiPost<CreateSessionResponse, { lane: string; summary: string; case_id: string }>("/v1/chat/session", {
      lane: resolveCaseLane(scene),
      summary: summary.slice(0, 300),
      case_id: caseId
    });

    setChatSessionId(created.session_id);
    return created.session_id;
  }

  async function submit() {
    const preparedDraft = trimDraft(draft);

    if (!hasMinimumContent(preparedDraft)) {
      showToast("先补齐事实和想要结果，姚律师才能拆得准");
      return;
    }

    if (!hasAuthToken()) {
      setCaseDraft(preparedDraft);
      setLoginReturnTo("/pages/consult/index");
      showToast("请先登录账号");
      onRequireLogin();
      return;
    }

    const messageForBackend = buildConsultMessageFromDraft(preparedDraft);

    if (!messageForBackend.trim()) {
      showToast("案件信息还不完整，先补充后再提交");
      return;
    }

    setIsSubmitting(true);

    try {
      const summary = preparedDraft.title || preparedDraft.facts;
      const caseId = await ensureCaseId(preparedDraft);
      const sessionId = await ensureSessionId(summary, caseId, preparedDraft.scene);
      const response = await apiPost<ChatRespondResponse, { session_id: string; user_message: string; output_mode: string }>(
        "/v1/chat/respond",
        {
          session_id: sessionId,
          user_message: messageForBackend,
          output_mode: "standard"
        }
      );

      setResult(response.data || null);
      setLastConsultResult(response.data);
      setCaseDraft(preparedDraft);
      showToast(response.data.status === "queued" ? "已进入人工核验队列" : "姚律师已生成结果卡");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function escalate() {
    if (!user) {
      showToast("请先登录账号");
      onRequireLogin();
      return;
    }

    const sessionId = getChatSessionId();
    const preparedDraft = trimDraft(draft);
    const messageForBackend = buildConsultMessageFromDraft(preparedDraft);

    if (!sessionId || !messageForBackend.trim()) {
      showToast("先完成一次案件分析再申请人工复核");
      return;
    }

    const confirm = await Taro.showModal({
      title: "申请人工复核",
      content: "会把当前案件摘要提交为人工复核工单，适合高风险或时间节点紧急的案件。"
    });

    if (!confirm.confirm) {
      return;
    }

    setIsEscalating(true);

    try {
      const response = await apiPost<
        EscalateHumanResponse,
        { session_id: string; reason: string; contact_mobile: string; priority: string }
      >("/v1/chat/escalate-human", {
        session_id: sessionId,
        reason: `移动端人工复核申请：${(preparedDraft.title || preparedDraft.facts).slice(0, 140)}`,
        contact_mobile: user.mobile,
        priority: result?.risk_level === "R1" ? "high" : "normal"
      });

      await Taro.showModal({
        title: "人工复核已提交",
        content: `工单号：${response.ticket_id}\n状态：${response.status}`,
        showCancel: false
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsEscalating(false);
    }
  }

  return {
    draft,
    messagePreview,
    result,
    isSubmitting,
    isEscalating,
    setDraftField,
    setUrgency,
    submit,
    escalate,
    selectQuickPrompt
  };
}
