import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { Badge, EmptyState, PageHero, SectionCard } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { useProfileActions } from "../../hooks/use-profile-actions";
import { formatMembershipDate, getQuotaTotal } from "../../utils/format";

type ValueEvent = {
  detail: {
    value: string;
  };
};

export default function ProfilePage() {
  const { user, saveUser, clearUser } = useCurrentUser();

  const {
    mobile,
    code,
    inviteCode,
    debugCode,
    sending,
    loggingIn,
    binding,
    claiming,
    setMobile,
    setCode,
    setInviteCode,
    sendCode,
    login,
    bindInvite,
    claimReward,
    copyInviteCode,
    logout
  } = useProfileActions({
    user,
    saveUser,
    clearUser
  });

  return (
    <View className="law-page law-page--profile">
      <PageHero
        className="page-hero--profile"
        eyebrow="YAO LAWYER / HOLD YOUR ACCESS"
        sticker={user ? "JUSTICE SERVED!" : "JUSTICE STARTS HERE"}
        title="账号别松手，权益别丢"
        description="登录以后，咨询、汇报、购买和邀请奖励才会全都记到你头上。没账号，前面折腾再多也容易散。"
        stats={
          user
            ? [
                { label: "账号状态", value: "已登录" },
                { label: "咨询额度", value: `${getQuotaTotal(user)} 次` },
                { label: "报告额度", value: `${user.free_report_quota} 次` }
              ]
            : [
                { label: "账号状态", value: "待登录" },
                { label: "登录方式", value: "手机号验证码" },
                { label: "邀请体系", value: "支持奖励" }
              ]
        }
        footer={<Text className="page-hero__tip">{user ? `当前邀请码：${user.invite_code}` : "先上号，邀请码才会真正归你。 "}</Text>}
        aside={
          <View className="profile-showcase">
            <Text className="profile-showcase__tag">{user ? "VIP CLIENT" : "ACCESS CARD"}</Text>
            <Text className="profile-showcase__name">{user ? user.mobile : "登录后绑定你的案件资产"}</Text>
            <Text className="profile-showcase__meta">{user ? `邀请码 ${user.invite_code}` : "短信验证码登录"}</Text>
            <View className="profile-showcase__chips">
              <Text className="profile-showcase__chip">{user ? `${getQuotaTotal(user)} 次咨询` : "支持邀请奖励"}</Text>
              <Text className="profile-showcase__chip">{user ? `${user.free_report_quota} 次报告` : "结果记录可追溯"}</Text>
            </View>
          </View>
        }
      />

      <SectionCard title="先上号再说" description="先把登录这一步狠狠干通，后面的咨询、汇报和购买才不会变成临时工状态。" tag="ACCESS">
        <View className="form-stack">
          <View>
            <Text className="field-label">手机号</Text>
            <Input
              className="input-control"
              value={mobile}
              type="number"
              placeholder="输入可接收验证码的手机号"
              onInput={(event: ValueEvent) => setMobile(event.detail.value)}
            />
          </View>

          <View>
            <Text className="field-label">验证码</Text>
            <Input
              className="input-control"
              value={code}
              type="number"
              placeholder="输入短信验证码"
              onInput={(event: ValueEvent) => setCode(event.detail.value)}
            />
            {debugCode ? <Text className="field-note">当前开发环境验证码：{debugCode}</Text> : null}
          </View>
        </View>

        <View className="button-row">
          <Button className="action-button action-button--secondary" loading={sending} onClick={sendCode}>
            获取验证码
          </Button>
          <Button className="action-button action-button--primary" loading={loggingIn} onClick={login}>
            登录账号
          </Button>
        </View>
      </SectionCard>

      <SectionCard title="这些才是你的弹药" description="这块不是摆设，它在告诉你当前账号还能继续打几轮。" tag="ASSETS">
        {user ? (
          <>
            <View className="summary-grid">
              <View className="info-card">
                <Text className="info-card__label">手机号</Text>
                <Text className="info-card__value">{user.mobile}</Text>
              </View>
              <View className="info-card">
                <Text className="info-card__label">邀请码</Text>
                <Text className="info-card__value">{user.invite_code}</Text>
              </View>
              <View className="info-card">
                <Text className="info-card__label">会籍状态</Text>
                <Text className="info-card__value">{formatMembershipDate(user.membership_expires_at)}</Text>
              </View>
              <View className="info-card">
                <Text className="info-card__label">可用咨询额度</Text>
                <Text className="info-card__value">{getQuotaTotal(user)} 次</Text>
              </View>
            </View>

            <View className="chip-row" style={{ marginTop: "16px" }}>
              <Badge label={`免费报告 ${user.free_report_quota} 次`} tone="success" />
              <Badge label={`付费额度 ${user.paid_chat_credits} 次`} tone="accent" />
            </View>

            <View className="shortcut-grid">
              <View className="shortcut-card shortcut-card--salmon" onClick={() => void Taro.switchTab({ url: "/pages/report/index" })}>
                <Text className="shortcut-card__label">我的结果</Text>
                <Text className="shortcut-card__body">回看最近一次结果卡和深度分析。</Text>
              </View>
              <View className="shortcut-card shortcut-card--blue" onClick={() => void Taro.switchTab({ url: "/pages/orders/index" })}>
                <Text className="shortcut-card__label">邀请好友</Text>
                <Text className="shortcut-card__body">继续裂变解锁，顺手升级更深的服务。</Text>
              </View>
              <View className="shortcut-card shortcut-card--yellow" onClick={() => void Taro.switchTab({ url: "/pages/consult/index" })}>
                <Text className="shortcut-card__label">继续体检</Text>
                <Text className="shortcut-card__body">再发起一条新案件，补材料也更顺手。</Text>
              </View>
            </View>

            <View className="button-row">
              <Button className="action-button action-button--secondary" onClick={copyInviteCode}>
                复制邀请码
              </Button>
              <Button className="action-button action-button--ghost" onClick={logout}>
                退出当前账号
              </Button>
            </View>
          </>
        ) : (
          <EmptyState title="你现在还没上号" description="先拿验证码登录，不然后面的咨询和购买结果都不会老老实实挂在你名下。" />
        )}
      </SectionCard>

      <SectionCard title="邀请码别白放着" description="把邀请码甩出去，对方一绑定成功，你就能回来这里把奖励领走。" tag="REWARD">
        <View className="form-stack">
          <View>
            <Text className="field-label">绑定他人的邀请码</Text>
            <Input
              className="input-control"
              value={inviteCode}
              placeholder="输入同事或朋友给你的邀请码"
              onInput={(event: ValueEvent) => setInviteCode(event.detail.value)}
            />
          </View>
        </View>

        <View className="button-row">
          <Button className="action-button action-button--secondary" loading={binding} onClick={bindInvite}>
            绑定邀请码
          </Button>
          <Button className="action-button action-button--primary" loading={claiming} onClick={claimReward}>
            领取邀请奖励
          </Button>
        </View>
      </SectionCard>
    </View>
  );
}
