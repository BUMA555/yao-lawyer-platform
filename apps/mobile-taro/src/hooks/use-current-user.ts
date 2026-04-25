import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect, useState } from "react";

import {
  apiGet,
  clearCurrentUser,
  clearLocalProfile,
  consumeLoginReturnTo,
  getCurrentUser,
  hasAuthToken,
  setCurrentUser
} from "../services/api";
import type { LoginUser, MeResponse } from "../types/api";

const TAB_PATHS = new Set(["/pages/consult/index", "/pages/report/index", "/pages/orders/index", "/pages/profile/index"]);
const PROFILE_PATH = "/pages/profile/index";

function normalizePath(path: string) {
  if (!path) {
    return "";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function isLoginUser(value: unknown): value is LoginUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.mobile === "string" &&
    typeof record.invite_code === "string" &&
    typeof record.free_chat_quota === "number" &&
    typeof record.free_report_quota === "number" &&
    typeof record.paid_chat_credits === "number"
  );
}

function resolveUserFromMe(payload: MeResponse | LoginUser) {
  if (isLoginUser(payload)) {
    return payload;
  }

  if ("user" in payload && isLoginUser(payload.user)) {
    return payload.user;
  }

  if ("data" in payload && isLoginUser(payload.data)) {
    return payload.data;
  }

  return null;
}

export function useCurrentUser() {
  const [isLoggedIn, setIsLoggedIn] = useState(hasAuthToken());
  const [user, setUser] = useState<LoginUser | null>(hasAuthToken() ? getCurrentUser() : null);

  async function refreshUser() {
    const loggedIn = hasAuthToken();
    setIsLoggedIn(loggedIn);

    if (!loggedIn) {
      if (getCurrentUser()) {
        clearCurrentUser();
      }
      setUser(null);
      return loggedIn;
    }

    try {
      const response = await apiGet<MeResponse | LoginUser>("/v1/auth/me");
      const syncedUser = resolveUserFromMe(response);

      if (syncedUser) {
        setCurrentUser(syncedUser);
        setUser(syncedUser);
      } else {
        setUser(getCurrentUser());
      }
    } catch {
      setUser(getCurrentUser());
    }

    return loggedIn;
  }

  function consumeLoginRedirectIfNeeded(loggedIn: boolean) {
    if (!loggedIn) {
      return;
    }

    const currentPath = normalizePath(Taro.getCurrentInstance().router?.path || "");

    if (currentPath !== PROFILE_PATH) {
      return;
    }

    const returnTo = consumeLoginReturnTo();

    if (!returnTo) {
      return;
    }

    const targetPath = normalizePath(returnTo);

    if (!targetPath || targetPath === currentPath) {
      return;
    }

    if (TAB_PATHS.has(targetPath)) {
      void Taro.switchTab({ url: targetPath });
      return;
    }

    void Taro.navigateTo({ url: targetPath });
  }

  function saveUser(nextUser: LoginUser) {
    setCurrentUser(nextUser);
    setIsLoggedIn(hasAuthToken());
    setUser(nextUser);
  }

  function clearUser() {
    clearLocalProfile();
    setIsLoggedIn(false);
    setUser(null);
  }

  useDidShow(() => {
    void refreshUser().then((loggedIn) => {
      consumeLoginRedirectIfNeeded(loggedIn);
    });
  });

  useEffect(() => {
    consumeLoginRedirectIfNeeded(isLoggedIn);
  }, [isLoggedIn]);

  return {
    isLoggedIn,
    user,
    refreshUser,
    saveUser,
    clearUser
  };
}
