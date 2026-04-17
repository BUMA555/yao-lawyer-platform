import Taro from "@tarojs/taro";
import { useState } from "react";

import { apiPost, setAuthToken } from "../services/api";
import type {
  BindReferralResponse,
  ClaimRewardResponse,
  LoginResponse,
  LoginUser,
  SendCodeResponse
} from "../types/api";
import { showErrorToast, showToast } from "../utils/feedback";

interface UseProfileActionsOptions {
  user: LoginUser | null;
  saveUser: (nextUser: LoginUser) => void;
  clearUser: () => void;
}

export function useProfileActions({ user, saveUser, clearUser }: UseProfileActionsOptions) {
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [binding, setBinding] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function sendCode() {
    const cleanedMobile = mobile.trim();

    if (!cleanedMobile) {
      showToast("先输入手机号");
      return;
    }

    setSending(true);

    try {
      const response = await apiPost<SendCodeResponse, { mobile: string; scene: string }>(
        "/v1/auth/mobile/send-code",
        { mobile: cleanedMobile, scene: "login" },
        false
      );

      if (response.debug_code) {
        setCode(response.debug_code);
        setDebugCode(response.debug_code);
      }

      showToast(response.debug_code ? "验证码已发送并自动填充" : "验证码已发送");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSending(false);
    }
  }

  async function login() {
    if (!mobile.trim() || !code.trim()) {
      showToast("手机号和验证码都要填");
      return;
    }

    setLoggingIn(true);

    try {
      const response = await apiPost<LoginResponse, { mobile: string; code: string; device_fingerprint: string; nickname: string }>(
        "/v1/auth/mobile/login",
        {
          mobile: mobile.trim(),
          code: code.trim(),
          device_fingerprint: "yao-lawyer-mobile",
          nickname: "姚律师用户"
        },
        false
      );

      setAuthToken(response.token);
      saveUser(response.user);
      setMobile(response.user.mobile);
      showToast("登录成功");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setLoggingIn(false);
    }
  }

  async function bindInvite() {
    if (!user) {
      showToast("请先登录账号");
      return;
    }

    if (!inviteCode.trim()) {
      showToast("先输入邀请码");
      return;
    }

    setBinding(true);

    try {
      await apiPost<BindReferralResponse, { invite_code: string; device_fingerprint: string }>("/v1/referral/bind", {
        invite_code: inviteCode.trim().toUpperCase(),
        device_fingerprint: "yao-lawyer-mobile"
      });

      showToast("邀请码绑定成功");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setBinding(false);
    }
  }

  async function claimReward() {
    if (!user) {
      showToast("请先登录账号");
      return;
    }

    setClaiming(true);

    try {
      const response = await apiPost<ClaimRewardResponse, { max_claim_count: number }>("/v1/referral/reward/claim", {
        max_claim_count: 10
      });

      if (response.granted_chat_credits > 0) {
        saveUser({
          ...user,
          paid_chat_credits: user.paid_chat_credits + response.granted_chat_credits
        });
      }

      showToast(`已领取 ${response.granted_chat_credits} 次额度`);
    } catch (error) {
      showErrorToast(error);
    } finally {
      setClaiming(false);
    }
  }

  async function copyInviteCode() {
    if (!user) {
      showToast("登录后才有邀请码");
      return;
    }

    await Taro.setClipboardData({ data: user.invite_code });
    showToast("邀请码已复制");
  }

  async function logout() {
    const confirm = await Taro.showModal({
      title: "退出当前账号",
      content: "会清理本地登录态、最近咨询会话和缓存结果。"
    });

    if (!confirm.confirm) {
      return;
    }

    clearUser();
    setCode("");
    setDebugCode("");
    setInviteCode("");
    showToast("已退出");
  }

  return {
    mobile,
    code,
    inviteCode,
    debugCode,
    sending,
    loggingIn,
    binding,
    claiming,
    setMobile,
    setCode,
    setInviteCode,
    sendCode,
    login,
    bindInvite,
    claimReward,
    copyInviteCode,
    logout
  };
}
