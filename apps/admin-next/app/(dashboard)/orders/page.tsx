import { fetchAdminOrders } from "@/lib/api";

function money(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

export default async function OrdersPage() {
  const token = process.env.ADMIN_BEARER_TOKEN || "";
  let orders: any[] = [];
  let error = "";

  try {
    const response = await fetchAdminOrders(token);
    orders = response.orders || [];
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "订单读取失败";
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>订单中心</h1>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: "8px", padding: "16px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
          <thead>
            <tr>
              {["订单号", "用户", "方案", "金额", "渠道", "状态", "创建时间"].map((label) => (
                <th key={label} style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ padding: "10px", fontFamily: "monospace" }}>{order.id.slice(0, 12)}</td>
                <td style={{ padding: "10px", fontFamily: "monospace" }}>{order.user_id.slice(0, 12)}</td>
                <td style={{ padding: "10px" }}>{order.plan_code}</td>
                <td style={{ padding: "10px" }}>{money(order.amount_cents)}</td>
                <td style={{ padding: "10px" }}>{order.channel}</td>
                <td style={{ padding: "10px" }}>{order.status}</td>
                <td style={{ padding: "10px" }}>{new Date(order.created_at).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && !error ? <p>暂无订单。</p> : null}
      </div>
    </div>
  );
}
