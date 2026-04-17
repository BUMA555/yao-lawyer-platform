import { useDidShow } from "@tarojs/taro";
import { useState } from "react";

import { clearLocalProfile, getCurrentUser, setCurrentUser } from "../services/api";
import type { LoginUser } from "../types/api";

export function useCurrentUser() {
  const [user, setUser] = useState<LoginUser | null>(getCurrentUser());

  function refreshUser() {
    setUser(getCurrentUser());
  }

  function saveUser(nextUser: LoginUser) {
    setCurrentUser(nextUser);
    setUser(nextUser);
  }

  function clearUser() {
    clearLocalProfile();
    setUser(null);
  }

  useDidShow(() => {
    refreshUser();
  });

  return {
    user,
    refreshUser,
    saveUser,
    clearUser
  };
}
