import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef } from "react";

import { Badge, EmptyState, PageHero, SectionCard, StitchTopBar } from "../../components/ui";
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
  const autoTestLoginStarted = useRef(false);

  const {
    mobile,
    code,
    inviteCode,
    debugCode,
    sending,
    loggingIn,
    quickLoggingIn,
    binding,
    claiming,
    canUseDevLogin,
    setMobile,
    setCode,
    setInviteCode,
    sendCode,
    login,
    quickDevLogin,
    bindInvite,
    claimReward,
    copyInviteCode,
    logout
  } = useProfileActions({
    user,
    saveUser,
    clearUser
  });

  useEffect(() => {
    if (user || !canUseDevLogin || autoTestLoginStarted.current || typeof window === "undefined") {
      return;
    }

    if (!window.location.search.includes("auto_test_login=1")) {
      return;
    }

    autoTestLoginStarted.current = true;
    void quickDevLogin();
  }, [canUseDevLogin, quickDevLogin, user]);

  return (
    <View className="law-page law-page--profile">
      <StitchTopBar active={user ? "ACCOUNT READY" : "POW! 登录入口"} action={user ? "我的资产" : "登录"} />

      <PageHero
        className="page-hero--profile stitch-profile-hero"
        eyebrow="YAO LAWYER / PROFILE"
        sticker={user ? "已登录" : "待登录"}
        title={user ? "我的姚律师" : "正义\n从这里开始"}
        description="登录后，提问记录、结果卡、算力余额和分享奖励才会稳定归到你的账号下。账号中心会承接案件资产、订单记录、奖励明细和服务边界。"
        actions={
          !user && canUseDevLogin ? (
            <Button className="action-button action-button--secondary local-test-login" loading={quickLoggingIn} onClick={quickDevLogin}>
              一键测试登录
            </Button>
          ) : null
        }
        stats={
          user
            ? [
                { label: "账号状态", value: "已登录" },
                { label: "可用算力", value: `${getQuotaTotal(user)}` },
                { label: "报告额度", value: `${user.free_report_quota} 次` }
              ]
            : [
                { label: "账号状态", value: "待登录" },
                { label: "登录方式", value: "手机号验证码" },
                { label: "邀请体系", value: "支持奖励" }
              ]
        }
        footer={<Text className="page-hero__tip">{user ? `当前邀请码：${user.invite_code}` : "先登录，结果和算力才会归到你名下。"}</Text>}
        aside={
          <View className="profile-showcase">
            <Text className="profile-showcase__tag">{user ? "ACCOUNT" : "ACCESS"}</Text>
            <Text className="profile-showcase__name">{user ? user.mobile : "登录后绑定\n你的结果卡"}</Text>
            <Text className="profile-showcase__meta">{user ? `邀请码 ${user.invite_code}` : "短信验证码登录"}</Text>
            <View className="profile-showcase__chips">
              <Text className="profile-showcase__chip">{user ? `${getQuotaTotal(user)} 点算力` : "支持邀请奖励"}</Text>
              <Text className="profile-showcase__chip">{user ? `${user.free_report_quota} 次报告` : "结果记录可追溯"}</Text>
            </View>
          </View>
        }
      />

      {!user ? (
        <SectionCard title="登录账号" description="先把登录跑通，后面提问、结果、算力和奖励才能稳定挂在你的名下。" tag="ACCESS" className="stitch-login-card">
          {canUseDevLogin ? (
            <View className="local-test-panel">
              <View>
                <Text className="local-test-panel__label">本地功能测试</Text>
                <Text className="local-test-panel__body">点一下会走真实验证码接口和登录接口，自动使用测试手机号 13800138000。</Text>
              </View>
              <Button className="action-button action-button--secondary local-test-panel__button" loading={quickLoggingIn} onClick={quickDevLogin}>
                直接登录测试账号
              </Button>
            </View>
          ) : null}

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
              {debugCode ? <Text className="field-note">开发环境验证码：{debugCode}</Text> : null}
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
      ) : null}

      <SectionCard title="账号资产" description="这里记录你的结果、算力、邀请码和会员状态。" tag="ASSETS" className="stitch-assets-card">
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
                <Text className="info-card__label">会员状态</Text>
                <Text className="info-card__value">{formatMembershipDate(user.membership_expires_at)}</Text>
              </View>
              <View className="info-card">
                <Text className="info-card__label">可用算力</Text>
                <Text className="info-card__value">{getQuotaTotal(user)}</Text>
              </View>
            </View>

            <View className="chip-row" style={{ marginTop: "16px" }}>
              <Badge label={`免费报告 ${user.free_report_quota} 次`} tone="success" />
              <Badge label={`付费算力 ${user.paid_chat_credits}`} tone="accent" />
            </View>

            <View className="shortcut-grid">
              <View className="shortcut-card shortcut-card--salmon" onClick={() => void Taro.switchTab({ url: "/pages/report/index" })}>
                <Text className="shortcut-card__label">我的结果</Text>
                <Text className="shortcut-card__body">回看最近结果卡和深度分析。</Text>
              </View>
              <View className="shortcut-card shortcut-card--blue" onClick={() => void Taro.switchTab({ url: "/pages/orders/index" })}>
                <Text className="shortcut-card__label">赚算力</Text>
                <Text className="shortcut-card__body">分享、邀请和活动奖励都在算力中心承接。</Text>
              </View>
              <View className="shortcut-card shortcut-card--yellow" onClick={() => void Taro.switchTab({ url: "/pages/consult/index" })}>
                <Text className="shortcut-card__label">问姚律师</Text>
                <Text className="shortcut-card__body">直接描述问题，生成新的结果卡。</Text>
              </View>
              <View className="shortcut-card shortcut-card--cyan">
                <Text className="shortcut-card__label">服务边界</Text>
                <Text className="shortcut-card__body">人工复核、电话沟通和文书服务以后会单独明示规则。</Text>
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
          <EmptyState title="你还没有登录" description="先拿验证码登录，不然后面的结果和算力不会稳定挂在你名下。" />
        )}
      </SectionCard>

      <SectionCard title="邀请码" description="把邀请码用出去，对方绑定成功后你就能回来领取算力奖励。" tag="REWARD" className="stitch-invite-card">
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
            领取算力奖励
          </Button>
        </View>
      </SectionCard>
    </View>
  );
}
