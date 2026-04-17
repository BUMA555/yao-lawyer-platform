import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "姚律师运营台",
  description: "订单、支付、风控、工单和模型运营"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "Segoe UI, PingFang SC, sans-serif", background: "#f2f4f8" }}>{children}</body>
    </html>
  );
}

