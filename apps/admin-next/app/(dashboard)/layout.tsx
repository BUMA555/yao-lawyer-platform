import Link from "next/link";
import React from "react";

const links = [
  { href: "/metrics", label: "指标" },
  { href: "/orders", label: "订单" },
  { href: "/tickets", label: "工单" },
  { href: "/risk", label: "风控" }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ background: "#0b1f3a", color: "#fff", padding: "20px" }}>
        <h2 style={{ marginTop: 0 }}>姚律师运营台</h2>
        <nav style={{ display: "grid", gap: "10px" }}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} style={{ color: "#d6deeb", textDecoration: "none" }}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ padding: "20px" }}>{children}</main>
    </div>
  );
}

