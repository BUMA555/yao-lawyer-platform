import Taro from "@tarojs/taro";
import { useState } from "react";

import {
  apiPost,
  getChatSessionId,
  getLastConsultMessage,
  getLastConsultResult,
  hasAuthToken,
  setChatSessionId,
  setLastConsultMessage,
  setLastConsultResult
} from "../services/api";
import type {
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

export function useConsultation({ user, onRequireLogin }: UseConsultationOptions) {
  const [message, setMessage] = useState(getLastConsultMessage());
  const [result, setResult] = useState<ChatRespondPayload | null>(getLastConsultResult());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  async function ensureSessionId(summary: string) {
    const existing = getChatSessionId();

    if (existing) {
      return existing;
    }

    const created = await apiPost<CreateSessionResponse, { lane: string; summary: string }>("/v1/chat/session", {
      lane: "civil-commercial",
      summary: summary.slice(0, 300)
    });

    setChatSessionId(created.session_id);
    return created.session_id;
  }

  async function submit() {
    const cleanedMessage = message.trim();

    if (!cleanedMessage) {
      showToast("先把案情写进去");
      return;
    }

    if (!hasAuthToken()) {
      showToast("请先登录账号");
      onRequireLogin();
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionId = await ensureSessionId(cleanedMessage);
      const response = await apiPost<ChatRespondResponse, { session_id: string; user_message: string; output_mode: string }>(
        "/v1/chat/respond",
        {
          session_id: sessionId,
          user_message: cleanedMessage,
          output_mode: "standard"
        }
      );

      setResult(response.data || null);
      setLastConsultResult(response.data);
      setLastConsultMessage(cleanedMessage);
      showToast(response.data.status === "queued" ? "已进入核验队列" : "分析完成");
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
    const cleanedMessage = message.trim();

    if (!sessionId || !cleanedMessage) {
      showToast("先完成一次咨询分析");
      return;
    }

    const confirm = await Taro.showModal({
      title: "申请人工复核",
      content: "会把当前案情摘要提交为人工复核工单，适合高风险或时间节点很紧的案件。"
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
        reason: `移动端人工复核申请：${cleanedMessage.slice(0, 140)}`,
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

  function selectQuickPrompt(nextMessage: string) {
    setMessage(nextMessage);
  }

  return {
    message,
    setMessage,
    result,
    isSubmitting,
    isEscalating,
    submit,
    escalate,
    selectQuickPrompt
  };
}
