import Taro from "@tarojs/taro";

import type { ChatRespondPayload, LoginUser } from "../types/api";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:8080";
const AUTH_TOKEN_KEY = "auth_token";
const CHAT_SESSION_KEY = "chat_session_id";
const CURRENT_USER_KEY = "current_user";
const LAST_CONSULT_RESULT_KEY = "last_consult_result";
const LAST_CONSULT_MESSAGE_KEY = "last_consult_message";

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
  Taro.setStorageSync(LAST_CONSULT_MESSAGE_KEY, message);
}

export function getLastConsultMessage() {
  const message = Taro.getStorageSync(LAST_CONSULT_MESSAGE_KEY);
  return typeof message === "string" ? message : "";
}

export function clearLocalProfile() {
  clearAuthToken();
  clearCurrentUser();
  clearChatSessionId();
  clearLastConsultResult();
  Taro.removeStorageSync(LAST_CONSULT_MESSAGE_KEY);
}
