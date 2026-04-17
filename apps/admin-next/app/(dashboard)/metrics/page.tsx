import { fetchAdminMetrics } from "@/lib/api";

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{ background: "#fff", borderRadius: "10px", padding: "14px", boxShadow: "0 2px 8px rgba(7, 25, 52, 0.08)" }}>
      <div style={{ color: "#6b778c", fontSize: "13px" }}>{title}</div>
      <div style={{ marginTop: "6px", fontSize: "24px", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default async function MetricsPage() {
  const token = process.env.ADMIN_BEARER_TOKEN || "";
  let metrics: any = null;
  let error = "";
  if (!token) {
    error = "请在环境变量设置 ADMIN_BEARER_TOKEN";
  } else {
    try {
      const res = await fetchAdminMetrics(token);
      metrics = res.metrics;
    } catch (err) {
      error = (err as Error).message;
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>运营指标</h1>
      {error ? (
        <p style={{ color: "#b42318" }}>{error}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: "12px" }}>
          <Card title="总用户" value={metrics.total_users} />
          <Card title="付费用户" value={metrics.paid_users} />
          <Card title="总订单" value={metrics.total_orders} />
          <Card title="已支付订单" value={metrics.paid_orders} />
          <Card title="总收入(元)" value={(metrics.total_revenue_cents / 100).toFixed(2)} />
          <Card title="开放工单" value={metrics.open_tickets} />
          <Card title="会话总数" value={metrics.chat_sessions} />
          <Card title="今日消息" value={metrics.messages_today} />
        </div>
      )}
    </div>
  );
}

