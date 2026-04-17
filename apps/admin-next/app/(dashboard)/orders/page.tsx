export default function OrdersPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>订单中心</h1>
      <div style={{ background: "#fff", borderRadius: "10px", padding: "16px" }}>
        <p>首版建议先接入以下能力：</p>
        <ul>
          <li>订单检索与状态筛选</li>
          <li>支付回调异常重放</li>
          <li>退款审核与对账标记</li>
          <li>渠道分账与毛利看板</li>
        </ul>
      </div>
    </div>
  );
}

