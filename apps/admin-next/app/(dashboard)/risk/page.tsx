import { fetchAdminEntitlements } from "@/lib/api";

export default async function RiskPage() {
  const token = process.env.ADMIN_BEARER_TOKEN || "";
  let entries: any[] = [];
  let error = "";

  try {
    const response = await fetchAdminEntitlements(token);
    entries = response.entries || [];
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "权益流水读取失败";
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>风控与权益流水</h1>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: "8px", padding: "16px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
          <thead>
            <tr>
              {["用户", "变动", "余额", "原因", "来源", "幂等键", "时间"].map((label) => (
                <th key={label} style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td style={{ padding: "10px", fontFamily: "monospace" }}>{entry.user_id.slice(0, 12)}</td>
                <td style={{ padding: "10px", color: entry.delta < 0 ? "#b42318" : "#027a48" }}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </td>
                <td style={{ padding: "10px" }}>{entry.balance_after}</td>
                <td style={{ padding: "10px" }}>{entry.reason}</td>
                <td style={{ padding: "10px" }}>{entry.source_type}</td>
                <td style={{ padding: "10px", fontFamily: "monospace" }}>{entry.idempotency_key}</td>
                <td style={{ padding: "10px" }}>{new Date(entry.created_at).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && !error ? <p>暂无权益流水。</p> : null}
      </div>
    </div>
  );
}
