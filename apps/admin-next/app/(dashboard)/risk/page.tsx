export default function RiskPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>风控与反作弊</h1>
      <div style={{ background: "#fff", borderRadius: "10px", padding: "16px" }}>
        <p>推荐监控项：</p>
        <ul>
          <li>同设备多账号注册与绑定邀请码频率</li>
          <li>同 IP 高频领取奖励/下单失败重试</li>
          <li>异常 Prompt 攻击（诱导违规建议）</li>
          <li>支付回调签名失败与重复通知</li>
        </ul>
      </div>
    </div>
  );
}

