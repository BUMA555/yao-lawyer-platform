import Taro from "@tarojs/taro";

import type { CaseDraft, CaseUrgency, ChatRespondPayload, LoginUser } from "../types/api";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:8080";
const AUTH_TOKEN_KEY = "auth_token";
const CHAT_SESSION_KEY = "chat_session_id";
const CURRENT_USER_KEY = "current_user";
const CURRENT_CASE_ID_KEY = "current_case_id";
const LAST_CONSULT_RESULT_KEY = "last_consult_result";
const LAST_CONSULT_MESSAGE_KEY = "last_consult_message";
const CASE_DRAFT_KEY = "case_draft";
const LOGIN_RETURN_TO_KEY = "login_return_to";

const CASE_URGENCY_SET: Set<CaseUrgency> = new Set(["low", "normal", "high", "critical"]);

export function isLocalTestEnvironment() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
}

function getToken() {
  return Taro.getStorageSync(AUTH_TOKEN_KEY);
}

function resolveDetail(data: unknown) {
  if (!data || typeof data !== "object") {
    return "request_failed";
  }

  const record = data as Record<string, unknown>;
  const detail = record.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => String(item)).join(" / ");
  }

  return "request_failed";
}

function normalizeUrgency(value: unknown): CaseUrgency {
  if (typeof value !== "string") {
    return "normal";
  }
  return CASE_URGENCY_SET.has(value as CaseUrgency) ? (value as CaseUrgency) : "normal";
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeCaseDraft(raw: unknown): CaseDraft | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;

  return {
    scene: asString(record.scene),
    title: asString(record.title),
    facts: asString(record.facts),
    evidence: asString(record.evidence),
    goal: asString(record.goal),
    urgency: normalizeUrgency(record.urgency),
    updated_at: asString(record.updated_at) || new Date().toISOString()
  };
}

function draftToLegacyMessage(draft: CaseDraft) {
  const lines: string[] = [];

  if (draft.title.trim()) {
    lines.push(`案件标题：${draft.title.trim()}`);
  }

  if (draft.scene.trim()) {
    lines.push(`场景：${draft.scene.trim()}`);
  }

  if (draft.facts.trim()) {
    lines.push(`关键事实：${draft.facts.trim()}`);
  }

  if (draft.evidence.trim()) {
    lines.push(`现有证据：${draft.evidence.trim()}`);
  }

  if (draft.goal.trim()) {
    lines.push(`目标诉求：${draft.goal.trim()}`);
  }

  lines.push(`紧急程度：${draft.urgency}`);

  return lines.join("\n");
}

function persistCaseDraft(draft: CaseDraft, syncLegacyMessage: boolean) {
  const nextDraft: CaseDraft = {
    ...draft,
    updated_at: new Date().toISOString()
  };

  Taro.setStorageSync(CASE_DRAFT_KEY, nextDraft);

  if (syncLegacyMessage) {
    Taro.setStorageSync(LAST_CONSULT_MESSAGE_KEY, draftToLegacyMessage(nextDraft));
  }
}

export async function apiPost<TResponse, TData>(path: string, data: TData, auth = true): Promise<TResponse> {
  const token = getToken();
  const response = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    method: "POST",
    data,
    header: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (response.statusCode >= 400) {
    throw new Error(resolveDetail(response.data));
  }
  return response.data as TResponse;
}

export async function apiPatch<TResponse, TData>(path: string, data: TData, auth = true): Promise<TResponse> {
  const token = getToken();
  const response = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    method: "PATCH",
    data,
    header: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (response.statusCode >= 400) {
    throw new Error(resolveDetail(response.data));
  }
  return response.data as TResponse;
}

export async function apiGet<TResponse>(path: string, auth = true): Promise<TResponse> {
  const token = getToken();
  const response = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    method: "GET",
    header: {
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (response.statusCode >= 400) {
    throw new Error(resolveDetail(response.data));
  }
  return response.data as TResponse;
}

export function createEmptyCaseDraft(scene = "general"): CaseDraft {
  return {
    scene,
    title: "",
    facts: "",
    evidence: "",
    goal: "",
    urgency: "normal",
    updated_at: new Date().toISOString()
  };
}

export function buildConsultMessageFromDraft(draft: CaseDraft | null) {
  if (!draft) {
    return "";
  }
  return draftToLegacyMessage(draft);
}

export function setCaseDraft(draft: CaseDraft) {
  persistCaseDraft(draft, true);
}

export function patchCaseDraft(patch: Partial<CaseDraft>) {
  const current = getCaseDraft() || createEmptyCaseDraft();
  const next: CaseDraft = {
    ...current,
    ...patch,
    urgency: normalizeUrgency(patch.urgency ?? current.urgency)
  };
  persistCaseDraft(next, true);
  return next;
}

export function getCaseDraft() {
  const draft = normalizeCaseDraft(Taro.getStorageSync(CASE_DRAFT_KEY));

  if (draft) {
    return draft;
  }

  const legacyMessage = getLastConsultMessage().trim();

  if (!legacyMessage) {
    return null;
  }

  const fromLegacy: CaseDraft = {
    ...createEmptyCaseDraft("legacy"),
    title: legacyMessage.slice(0, 28),
    facts: legacyMessage
  };

  persistCaseDraft(fromLegacy, false);
  return fromLegacy;
}

export function clearCaseDraft() {
  Taro.removeStorageSync(CASE_DRAFT_KEY);
}

export function getAuthToken() {
  const token = Taro.getStorageSync(AUTH_TOKEN_KEY);
  return typeof token === "string" && token ? token : null;
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export function setAuthToken(token: string) {
  Taro.setStorageSync(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  Taro.removeStorageSync(AUTH_TOKEN_KEY);
}

export function getChatSessionId() {
  const sessionId = Taro.getStorageSync(CHAT_SESSION_KEY);
  return typeof sessionId === "string" && sessionId ? sessionId : null;
}

export function setChatSessionId(sessionId: string) {
  Taro.setStorageSync(CHAT_SESSION_KEY, sessionId);
}

export function clearChatSessionId() {
  Taro.removeStorageSync(CHAT_SESSION_KEY);
}

export function setCurrentUser(user: LoginUser) {
  Taro.setStorageSync(CURRENT_USER_KEY, user);
}

export function getCurrentUser() {
  const user = Taro.getStorageSync(CURRENT_USER_KEY);
  if (!user || typeof user !== "object") {
    return null;
  }
  return user as LoginUser;
}

export function clearCurrentUser() {
  Taro.removeStorageSync(CURRENT_USER_KEY);
}

export function getCurrentCaseId() {
  const caseId = Taro.getStorageSync(CURRENT_CASE_ID_KEY);
  return typeof caseId === "string" && caseId ? caseId : null;
}

export function setCurrentCaseId(caseId: string) {
  Taro.setStorageSync(CURRENT_CASE_ID_KEY, caseId);
}

export function clearCurrentCaseId() {
  Taro.removeStorageSync(CURRENT_CASE_ID_KEY);
}

export function setLastConsultResult(payload: ChatRespondPayload) {
  Taro.setStorageSync(LAST_CONSULT_RESULT_KEY, payload);
}

export function getLastConsultResult() {
  const result = Taro.getStorageSync(LAST_CONSULT_RESULT_KEY);
  if (!result || typeof result !== "object") {
    return null;
  }
  return result as ChatRespondPayload;
}

export function clearLastConsultResult() {
  Taro.removeStorageSync(LAST_CONSULT_RESULT_KEY);
}

export function setLastConsultMessage(message: string) {
  const nextMessage = typeof message === "string" ? message : "";
  Taro.setStorageSync(LAST_CONSULT_MESSAGE_KEY, nextMessage);

  if (!nextMessage.trim()) {
    return;
  }

  const current = getCaseDraft() || createEmptyCaseDraft();
  const nextDraft: CaseDraft = {
    ...current,
    facts: nextMessage,
    title: current.title.trim() ? current.title : nextMessage.slice(0, 28)
  };

  persistCaseDraft(nextDraft, false);
}

export function getLastConsultMessage() {
  const message = Taro.getStorageSync(LAST_CONSULT_MESSAGE_KEY);
  return typeof message === "string" ? message : "";
}

export function clearLastConsultMessage() {
  Taro.removeStorageSync(LAST_CONSULT_MESSAGE_KEY);
}

export function setLoginReturnTo(path: string) {
  const cleanedPath = path.trim();
  if (!cleanedPath) {
    return;
  }
  Taro.setStorageSync(LOGIN_RETURN_TO_KEY, cleanedPath);
}

export function getLoginReturnTo() {
  const path = Taro.getStorageSync(LOGIN_RETURN_TO_KEY);
  return typeof path === "string" && path ? path : null;
}

export function consumeLoginReturnTo() {
  const path = getLoginReturnTo();
  if (path) {
    Taro.removeStorageSync(LOGIN_RETURN_TO_KEY);
  }
  return path;
}

export function clearLoginReturnTo() {
  Taro.removeStorageSync(LOGIN_RETURN_TO_KEY);
}

export function clearLocalProfile() {
  clearAuthToken();
  clearCurrentUser();
  clearCurrentCaseId();
  clearChatSessionId();
  clearLastConsultResult();
  clearLastConsultMessage();
  clearCaseDraft();
  clearLoginReturnTo();
}
