import Taro from "@tarojs/taro";

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "request_failed";
}

export function showToast(title: string) {
  return Taro.showToast({ title, icon: "none" });
}

export function showErrorToast(error: unknown) {
  return showToast(getErrorMessage(error));
}
