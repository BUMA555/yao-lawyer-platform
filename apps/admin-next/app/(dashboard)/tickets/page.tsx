import { fetchAdminTickets } from "@/lib/api";

export default async function TicketsPage() {
  const token = process.env.ADMIN_BEARER_TOKEN || "";
  let tickets: any[] = [];
  let error = "";

  try {
    const response = await fetchAdminTickets(token);
    tickets = response.tickets || [];
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "工单读取失败";
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>真人升级工单</h1>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
      <div style={{ display: "grid", gap: "10px" }}>
        {tickets.map((ticket) => (
          <article key={ticket.id} style={{ background: "#fff", borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <strong>{ticket.title || ticket.task_type}</strong>
              <span>{ticket.priority} · {ticket.status}</span>
            </div>
            <p style={{ color: "#475467" }}>{ticket.description}</p>
            <small>
              工单 {ticket.id.slice(0, 12)} · 案件 {ticket.case_id.slice(0, 12)} · {new Date(ticket.created_at).toLocaleString("zh-CN")}
            </small>
          </article>
        ))}
        {!tickets.length && !error ? <p>暂无工单。</p> : null}
      </div>
    </div>
  );
}
