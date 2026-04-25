import React, { useEffect } from "react";
import type { PropsWithChildren } from "react";

import { getCurrentUser, setAuthToken, setCurrentUser } from "./services/api";
import type { LoginResponse } from "./types/api";

import "./app.css";

const DEBUG_LOGIN_PARAMS = ["debugLoginMobile", "debug_login_mobile"];
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:8080";

function useDebugPreviewLogin() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const paramName = DEBUG_LOGIN_PARAMS.find((item) => url.searchParams.get(item));
    const mobile = paramName ? url.searchParams.get(paramName)?.trim() : "";

    if (!mobile) {
      return;
    }

    const currentUser = getCurrentUser();
    if (currentUser?.mobile === mobile) {
      if (paramName) {
        url.searchParams.delete(paramName);
        window.history.replaceState({}, "", url.toString());
      }
      return;
    }

    let active = true;

    async function applyDebugLogin() {
      try {
        const sendCodeResponse = await fetch(`${API_BASE_URL}/v1/auth/mobile/send-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, scene: "login" })
        });
        const sendCodePayload = (await sendCodeResponse.json()) as { debug_code?: string };

        if (!sendCodeResponse.ok || !sendCodePayload.debug_code) {
          return;
        }

        const loginResponse = await fetch(`${API_BASE_URL}/v1/auth/mobile/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobile,
            code: sendCodePayload.debug_code,
            device_fingerprint: "yao-lawyer-h5-debug",
            nickname: "姚律师预览用户"
          })
        });
        const loginPayload = (await loginResponse.json()) as LoginResponse;

        if (!active || !loginResponse.ok) {
          return;
        }

        setAuthToken(loginPayload.token);
        setCurrentUser(loginPayload.user);

        if (paramName) {
          url.searchParams.delete(paramName);
        }

        window.location.replace(url.toString());
      } catch {
        // Dev-only preview helper; failures should not block the app.
      }
    }

    void applyDebugLogin();

    return () => {
      active = false;
    };
  }, []);
}

function App({ children }: PropsWithChildren) {
  useDebugPreviewLogin();

  return <>{children}</>;
}

export default App;
