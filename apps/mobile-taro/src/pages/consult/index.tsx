import { View, Text, Textarea, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect } from "react";

import homeReferenceCover from "../../assets/home-reference-cover.jpg";
import homeTypeContract from "../../assets/home-type-contract.jpg";
import homeTypeFamily from "../../assets/home-type-family.jpg";
import homeTypeLabor from "../../assets/home-type-labor.jpg";
import homeTypeLoan from "../../assets/home-type-loan.jpg";
import { CaseResultBoard } from "../../components/case-result-board";
import { SectionCard } from "../../components/ui";
import { useConsultation } from "../../hooks/use-consultation";
import { useCurrentUser } from "../../hooks/use-current-user";
import { PENDING_INVITE_CODE_KEY } from "../../hooks/use-profile-actions";
import {
  clearCaseDraft,
  clearChatSessionId,
  clearCurrentCaseId,
  clearLastConsultResult
} from "../../services/api";
import type { CaseUrgency } from "../../types/api";
import { getQuotaTotal } from "../../utils/format";

type ValueEvent = {
  detail: {
    value: string;
  };
};

type PromptGuide = {
  key: string;
  scene: string;
  title: string;
  label: string;
  subtitle: string;
  facts: string;
  evidence: string;
  goal: string;
  urgency: CaseUrgency;
};

const TYPE_ICON_MAP: Record<string, string> = {
  contract: homeTypeContract,
  family: homeTypeFamily,
  labor: homeTypeLabor,
  loan: homeTypeLoan
};

const PROMPT_GUIDES: PromptGuide[] = [
  {
    key: "labor",
    scene: "labor",
    title: "劳动纠纷咨询",
    label: "劳动纠纷",
    subtitle: "辞退、欠薪、仲裁、社保",
    facts:
      "我在【公司名称】工作【多久】，岗位是【岗位】。公司在【时间】通知我【辞退/降薪/停工/拖欠工资】，给出的理由是【公司说法】，目前欠我【工资/补偿/加班费】。",
    evidence: "劳动合同、工资流水、考勤记录、工作群聊天、辞退通知、录音或书面沟通。",
    goal: "想知道仲裁前先准备什么、能主张哪些费用、下一步怎么留痕。",
    urgency: "high"
  },
  {
    key: "contract",
    scene: "civil-commercial",
    title: "合同纠纷咨询",
    label: "合同纠纷",
    subtitle: "合同欠款、违约、保全",
    facts:
      "我和【对方/公司】签过【合同类型】，约定金额【金额】。我已经完成【交付/服务/供货】，对方应在【时间】付款，但现在拖欠【金额/尾款】，理由是【对方说法】。",
    evidence: "合同、订单、验收记录、发票、对账单、付款记录、催款聊天或函件。",
    goal: "想判断是否需要先保全、现在起诉是否稳、证据还缺哪些。",
    urgency: "normal"
  },
  {
    key: "family",
    scene: "family",
    title: "婚姻家事咨询",
    label: "婚姻家事",
    subtitle: "离婚、抚养、财产、债务",
    facts:
      "我和【对方】目前处于【协商/分居/准备离婚/已经起诉】阶段。争议点主要是【孩子抚养/财产分割/债务/房产/彩礼】。关键时间线是【按时间写清楚】。",
    evidence: "结婚证、户口本、房产/车辆/存款线索、转账记录、聊天记录、孩子照护记录。",
    goal: "想先判断我的底线方案、证据缺口和下一步谈判或起诉顺序。",
    urgency: "normal"
  },
  {
    key: "loan",
    scene: "fraud-boundary",
    title: "借款欠款咨询",
    label: "借款欠款",
    subtitle: "借钱不还、催收、刑民边界",
    facts:
      "我在【时间】借给【对方关系】人民币【金额】元，约定【还款时间/方式】归还。现在对方已经拖了【多久】，最近一次沟通是【时间】，对方说【对方原话/态度】。",
    evidence: "转账记录、聊天记录、催款记录、对方承认借款或承诺还款的文字/语音。",
    goal: "想判断现在更适合起诉、调解还是报警，并想知道先补哪些证据。",
    urgency: "high"
  }
] as const;

const FLOW_STEPS = [
  {
    no: "1",
    title: "整理案情",
    body: "梳理时间线、对方、证据与目标"
  },
  {
    no: "2",
    title: "判断风险",
    body: "分析法律关系，评估风险与胜算"
  },
  {
    no: "3",
    title: "行动建议",
    body: "给出策略与方案，明确下一步行动"
  }
] as const;

const PROMPT_FORMULAS = [
  {
    label: "生成标准问法",
    title: "标准案件咨询",
    facts:
      "【发生时间】\n【对方是谁】\n【发生了什么】\n【金额/损失/影响】\n【对方现在怎么说】",
    evidence: "【已有证据】合同、转账、聊天、录音、照片、通知、快递单、证人等。",
    goal: "【想要结果】要回钱、解除合同、申请仲裁、起诉、报警、先保全、先谈判。"
  },
  {
    label: "先问风险",
    title: "先判断风险等级",
    facts: "我想先判断这件事现在最大的风险是什么。事情经过是：【按时间线写清楚】。",
    evidence: "目前能证明事实的材料有：【逐项列出来】。",
    goal: "请先告诉我最危险的点、哪些动作先不要做、48 小时内先做什么。"
  },
  {
    label: "先问证据",
    title: "先检查证据缺口",
    facts: "我准备推进这件事，但不确定证据够不够。核心事实是：【写清楚争议点】。",
    evidence: "我已有证据：【列证据】。还没有的证据：【列不确定项】。",
    goal: "请帮我判断证据强弱、缺口和补证顺序。"
  }
] as const;

function applyToast(message: string) {
  void Taro.showToast({ title: message, icon: "none", duration: 1600 });
}

function scrollTo(selector: string) {
  void Taro.pageScrollTo({ selector, duration: 260 });
}

export default function ConsultPage() {
  const { user, isLoggedIn } = useCurrentUser();
  const inviteCodeFromShare = String(Taro.getCurrentInstance().router?.params?.invite_code || "");

  useEffect(() => {
    if (inviteCodeFromShare.trim()) {
      Taro.setStorageSync(PENDING_INVITE_CODE_KEY, inviteCodeFromShare.trim().toUpperCase());
    }
  }, [inviteCodeFromShare]);

  function jumpToProfile() {
    void Taro.switchTab({ url: "/pages/profile/index" });
  }

  const {
    draft,
    result,
    isSubmitting,
    isEscalating,
    setDraftField,
    setUrgency,
    selectQuickPrompt,
    submit,
    escalate
  } = useConsultation({
    user,
    onRequireLogin: jumpToProfile
  });

  const question = draft.facts;
  const evidence = draft.evidence;
  const goal = draft.goal;
  const canAsk = question.trim().length >= 12 && goal.trim().length >= 4;
  const availableCredits = user ? getQuotaTotal(user) : 0;

  function applyGuide(guide: PromptGuide) {
    selectQuickPrompt(guide);
    applyToast("已套入咨询模板，往下补充细节就能生成结果卡");
    scrollTo("#consult-ask-form");
  }

  function applyFormula(item: (typeof PROMPT_FORMULAS)[number]) {
    selectQuickPrompt({
      scene: draft.scene || "civil-commercial",
      title: item.title,
      facts: item.facts,
      evidence: item.evidence,
      goal: item.goal,
      urgency: draft.urgency || "normal"
    });
    applyToast("已套用提问公式");
  }

  function markUrgent() {
    setUrgency("critical");
    if (!goal.trim()) {
      setDraftField("goal", "想先判断是否需要马上保全、报警、仲裁或起诉，以及今天必须先做什么。");
    }
    applyToast("已标记为紧急问题");
  }

  function startFresh() {
    clearCaseDraft();
    clearCurrentCaseId();
    clearChatSessionId();
    clearLastConsultResult();
    setDraftField("scene", "general");
    setDraftField("title", "");
    setDraftField("facts", "");
    setDraftField("evidence", "");
    setDraftField("goal", "");
    setUrgency("normal");
  }

  return (
    <View className="law-page law-page--consult comic-home">
      <View className="comic-reference-cover">
        <View className="comic-reference-cover__image" style={{ backgroundImage: `url(${homeReferenceCover})` }} />
        <Button
          className="comic-reference-cover__hotspot comic-reference-cover__hotspot--top"
          onClick={() => scrollTo("#consult-ask-form")}
        >
          立即咨询
        </Button>
        <Button
          className="comic-reference-cover__hotspot comic-reference-cover__hotspot--ask"
          onClick={() => scrollTo("#consult-ask-form")}
        >
          立即描述问题
        </Button>
        <Button
          className="comic-reference-cover__hotspot comic-reference-cover__hotspot--flow"
          onClick={() => scrollTo("#consult-flow")}
        >
          查看咨询流程
        </Button>
      </View>

      <View className="comic-section comic-type-section">
        <Text className="comic-ribbon">常见咨询类型</Text>
        <View className="comic-type-grid">
          {PROMPT_GUIDES.map((guide) => (
            <Button key={guide.key} className="comic-type-card" onClick={() => applyGuide(guide)}>
              <View className="comic-type-card__icon" style={{ backgroundImage: `url(${TYPE_ICON_MAP[guide.key]})` }} />
              <View className="comic-type-card__copy">
                <Text className="comic-type-card__title">{guide.label}</Text>
                <Text className="comic-type-card__line" />
                <Text className="comic-type-card__subtitle">{guide.subtitle}</Text>
              </View>
            </Button>
          ))}
        </View>
      </View>

      <View id="consult-flow" className="comic-section comic-flow-section">
        <Text className="comic-ribbon">咨询流程</Text>
        <View className="comic-flow-row">
          {FLOW_STEPS.map((step, index) => (
            <View key={step.no} className="comic-flow-card">
              <Text className="comic-flow-card__no">{step.no}</Text>
              <Text className="comic-flow-card__title">{step.title}</Text>
              <Text className="comic-flow-card__body">{step.body}</Text>
              {index < FLOW_STEPS.length - 1 ? <Text className="comic-flow-card__arrow">▶</Text> : null}
            </View>
          ))}
        </View>
      </View>

      <View className="comic-sticky-cta" onClick={() => scrollTo("#consult-ask-form")}>
        <Text className="comic-sticky-cta__text">立即开始咨询</Text>
        <Text className="comic-sticky-cta__hand">☝</Text>
      </View>

      <View id="consult-ask-form" className="comic-section comic-ask-section">
        <Text className="comic-ribbon">立即开始咨询</Text>
        <View className="comic-ask-card">
          <View className="comic-status-row">
            <Text className="comic-status-pill">账号：{isLoggedIn ? "已登录" : "待登录"}</Text>
            <Text className="comic-status-pill">算力：{isLoggedIn ? `${availableCredits}` : "登录后看"}</Text>
            <Text className="comic-status-pill">输出：风险结果卡</Text>
          </View>

          <View className="comic-formula-row">
            {PROMPT_FORMULAS.map((item) => (
              <Button key={item.label} className="comic-formula-button" onClick={() => applyFormula(item)}>
                {item.label}
              </Button>
            ))}
            <Button className="comic-formula-button comic-formula-button--danger" onClick={markUrgent}>
              事情很急
            </Button>
          </View>

          <View className="comic-field">
            <Text className="comic-field__label">1. 事实经过</Text>
            <Textarea
              className="comic-field__input comic-field__input--large"
              value={question}
              maxlength={4000}
              placeholder="按时间线写：什么时候、谁、发生什么、金额/损失多少、对方现在怎么说。"
              onInput={(event: ValueEvent) => setDraftField("facts", event.detail.value)}
            />
          </View>

          <View className="comic-field-grid">
            <View className="comic-field">
              <Text className="comic-field__label">2. 已有证据</Text>
              <Textarea
                className="comic-field__input"
                value={evidence}
                maxlength={1200}
                placeholder="例如：合同、转账记录、聊天截图、录音、通知、照片。"
                onInput={(event: ValueEvent) => setDraftField("evidence", event.detail.value)}
              />
            </View>
            <View className="comic-field">
              <Text className="comic-field__label">3. 想要结果</Text>
              <Textarea
                className="comic-field__input"
                value={goal}
                maxlength={800}
                placeholder="例如：要回钱、先保全、起诉、仲裁、报警、谈判。"
                onInput={(event: ValueEvent) => setDraftField("goal", event.detail.value)}
              />
            </View>
          </View>

          <View className="comic-submit-row">
            <Text className="comic-submit-row__hint">{question.trim().length}/4000 · {goal.trim() ? "目标已写" : "还差想要结果"}</Text>
            <View className="comic-submit-row__buttons">
              <Button className="comic-clear-button" onClick={startFresh}>
                清空
              </Button>
              <Button className="comic-submit-button" loading={isSubmitting} disabled={!canAsk} onClick={submit}>
                立即生成结果卡
              </Button>
            </View>
          </View>
        </View>
      </View>

      {result ? (
        <SectionCard title="姚律师刚给出的结果卡" description="结果已保存到“结果”页，也可以继续人工复核。" tag="RESULT">
          <CaseResultBoard
            report={result}
            footer={
              <View className="button-row">
                <Button className="action-button action-button--secondary" onClick={() => void Taro.switchTab({ url: "/pages/report/index" })}>
                  查看完整结果
                </Button>
                <Button className="action-button action-button--ghost" loading={isEscalating} onClick={escalate}>
                  申请人工复核
                </Button>
              </View>
            }
          />
        </SectionCard>
      ) : null}
    </View>
  );
}
