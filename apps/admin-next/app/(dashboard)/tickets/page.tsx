export default function TicketsPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>真人升级工单</h1>
      <div style={{ background: "#fff", borderRadius: "10px", padding: "16px" }}>
        <p>AI 转真人工单建议字段：</p>
        <ul>
          <li>优先级（R0-R3）</li>
          <li>案件赛道（民商/劳动/公司控制/刑民交叉）</li>
          <li>48小时动作是否已完成</li>
          <li>客户联系方式与回访 SLA</li>
        </ul>
      </div>
    </div>
  );
}

