import type { ChatRespondPayload, LoginUser, Plan } from "../types/api";

const LANE_LABELS: Record<string, string> = {
  "civil-commercial": "民商争议",
  "company-control": "公司控制权",
  labor: "劳动纠纷",
  "fraud-boundary": "刑民交叉"
};

const RISK_LABELS: Record<string, string> = {
  R1: "高风险核验",
  R2: "重点核验",
  R3: "常规分析"
};

const STATUS_LABELS: Record<string, string> = {
  ok: "已生成建议",
  queued: "进入人工核验队列"
};

const RESULT_BOARD_BY_LANE: Record<
  string,
  {
    summary: string;
    dangerPoint: string;
    evidenceGaps: string[];
    routeSuggestions: string[];
  }
> = {
  "civil-commercial": {
    summary: "从你目前给的信息看，这件事更像民商争议，重点不是先喊态度，而是先把履行链和付款链补齐。",
    dangerPoint: "你现在最大的问题不是“会不会赢”，而是合同履行、对账确认或付款往来的证据链可能断在关键一环。",
    evidenceGaps: ["合同签订与履行确认记录", "对账单 / 催款记录 / 发票", "对方认可欠款或拖延付款的明确表态"],
    routeSuggestions: ["先整理履行和付款证据", "评估起诉还是先律师函/保全", "必要时先补强送达和催收留痕"]
  },
  labor: {
    summary: "从你目前给的信息看，这更像劳动争议，先抓离职性质、工资流水和用工痕迹，不要先被情绪带跑。",
    dangerPoint: "你现在最危险的不是态度输赢，而是劳动关系和加班/辞退事实如果说不清，后面仲裁很容易被动。",
    evidenceGaps: ["劳动合同 / 入职沟通 / 工牌工位证明", "工资流水 / 考勤排班 / 工作群记录", "辞退通知 / 逼迫离职 / 谈话留痕"],
    routeSuggestions: ["先锁定劳动关系和在岗证据", "判断先谈还是直接准备仲裁", "把仲裁请求和证据目录同步拉清"]
  },
  "company-control": {
    summary: "从现有信息看，问题更偏公司控制权或管理权争议，第一优先不是吵，而是立刻控章、控账、控后台权限。",
    dangerPoint: "最危险的是权限被改、资料被删、财务或印章被单方控制，一旦晚一步，后面所有动作都会被卡死。",
    evidenceGaps: ["公章 / 网银 / 邮箱 / 后台权限现状截图", "股东决议 / 任命文件 / 授权链", "最近异常操作或权限变更留痕"],
    routeSuggestions: ["先做权限与资料保全", "同步评估公司治理动作和诉前保全", "必要时立即固定对方异常操作证据"]
  },
  "fraud-boundary": {
    summary: "从现有信息看，这件事更像刑民边界问题，先判断证据链能不能支撑，再决定要不要往报警方向走。",
    dangerPoint: "真正危险的不是“报不报警”，而是把民事借贷、合作失败和诈骗定性混在一起，反而把自己带进被动。",
    evidenceGaps: ["对方承诺用途与事实不一致的证据", "资金流向 / 转账备注 / 还款承诺", "诱导表述、虚构身份或虚假承诺留痕"],
    routeSuggestions: ["先做刑民边界核验", "先补齐借款/诈骗区分证据", "必要时先民事固定材料，再评估报警时机"]
  }
};

const RISK_NOTES: Record<string, string> = {
  R1: "当前可能存在财产转移、证据灭失或关键节点逼近风险。",
  R2: "已经出现程序风险或证据风险，继续拖会更被动。",
  R3: "暂时没有爆点，但先把证据和动作顺序排清楚更重要。"
};

export const HOME_SCENARIOS = [
  {
    code: "fraud-boundary",
    title: "借钱不还",
    subtitle: "先判断更像民事还是诈骗",
    prompt: "借给熟人一笔钱，对方一直拖着不还，我有转账记录和聊天记录，但不知道更像民事借贷还是诈骗。"
  },
  {
    code: "labor",
    title: "被辞退 / 工资拖欠",
    subtitle: "先看仲裁重点和证据缺口",
    prompt: "公司突然把我辞退，还拖着工资和补偿没给，我有工资流水和工作群聊天，仲裁前先该准备什么？"
  },
  {
    code: "civil-commercial",
    title: "合同欠款",
    subtitle: "先看起诉还是保全更优先",
    prompt: "客户拖欠合同款，对账和催款记录都有，但一直不给时间，我现在先起诉还是先保全更稳？"
  },
  {
    code: "evidence",
    title: "证据整理",
    subtitle: "先看你现在还差什么关键材料",
    prompt: "我手里有聊天截图、合同照片和转账记录，但很乱，想先知道哪些证据最关键、还缺什么。"
  }
] as const;

export const HOME_MISTAKES = [
  "借贷纠纷证据不足时，先别直接往诈骗上冲。",
  "劳动纠纷别先发长篇情绪文，先保工资、考勤和在岗痕迹。",
  "合同欠款别急着摊牌或起诉，先把时间线和证据目录拉平。",
  "高风险场景先保全、先留痕，别一上来就公开定性。"
] as const;

export function formatLane(value: string) {
  return LANE_LABELS[value] || "案件分析";
}

export function formatRiskLevel(value: string) {
  return RISK_LABELS[value] || value;
}

export function formatStatus(value: string) {
  return STATUS_LABELS[value] || value;
}

export function formatCurrency(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function formatMembershipDate(value: string | null | undefined) {
  if (!value) return "未开通会籍";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getQuotaTotal(user: LoginUser | null) {
  if (!user) return 0;
  return user.free_chat_quota + user.paid_chat_credits;
}

export function getQuotaSummary(user: LoginUser | null) {
  if (!user) return "登录后可解锁咨询、汇报、支付和邀请闭环。";
  return `当前可用 ${getQuotaTotal(user)} 次咨询额度，${user.free_report_quota} 次报告额度。`;
}

function getLaneBoard(value: string) {
  return RESULT_BOARD_BY_LANE[value] || RESULT_BOARD_BY_LANE["civil-commercial"];
}

export function buildResultBoard(report: ChatRespondPayload) {
  const laneBoard = getLaneBoard(report.lane);

  return {
    summary: laneBoard.summary,
    riskNote: RISK_NOTES[report.risk_level] || "先把事实链、证据链和程序节点排清，再决定往哪条路上走。",
    dangerPoint: laneBoard.dangerPoint,
    evidenceGaps: laneBoard.evidenceGaps,
    actionPlan: report.next_actions.length ? report.next_actions : ["先保留现有证据原件", "先拉完整时间线", "先停掉情绪化动作"],
    routeSuggestions: laneBoard.routeSuggestions,
    notRecommended: report.not_recommended.length
      ? report.not_recommended
      : ["证据还没补齐前先别公开定性", "程序节点不清前先别贸然起诉或报警"]
  };
}

export function buildShareCopy(report: ChatRespondPayload | null) {
  if (!report) {
    return "我刚做了一个案件体检，结果不是空话，而是直接告诉我现在最危险点在哪、48 小时先做什么。";
  }

  const board = buildResultBoard(report);
  return [
    `我刚做了一个案件体检，当前更像：${formatLane(report.lane)}。`,
    `最危险点不是“能不能赢”，而是：${board.dangerPoint}`,
    `48 小时先做：${board.actionPlan[0] || "先把证据和时间线拉清"}`,
    "你也可以先测一下，再决定要不要往下走。"
  ].join("");
}

export function buildReportText(report: ChatRespondPayload | null) {
  if (!report) return "";
  const board = buildResultBoard(report);
  const nextActions = board.actionPlan.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const evidenceGaps = board.evidenceGaps.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const routes = board.routeSuggestions.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const avoidList = board.notRecommended.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return [
    `状态：${formatStatus(report.status)}`,
    `赛道：${formatLane(report.lane)}`,
    `风险级别：${formatRiskLevel(report.risk_level)}`,
    "",
    "当前判断",
    board.summary,
    "",
    "当前最危险点",
    board.dangerPoint,
    "",
    "你最该补的 3 个证据",
    evidenceGaps,
    "",
    "48 小时动作清单",
    nextActions,
    "",
    "当前更适合的路径",
    routes,
    "",
    "现在先别做",
    avoidList,
    "",
    "深度视角预览",
    `法官版：${report.judge_version}`,
    `客户版：${report.client_version}`,
    `团队版：${report.team_version}`
  ].join("\n");
}

export function getPlanPresentation(plan: Plan) {
  const map: Record<
    string,
    {
      title: string;
      badge: string;
      description: string;
      featureA: string;
      featureB: string;
      featureC: string;
      featured?: boolean;
    }
  > = {
    "trial-pack": {
      title: "体验包",
      badge: "低门槛试用",
      description: "适合第一次跑通咨询、汇报、支付闭环，先验证产品是否匹配你的办案节奏。",
      featureA: "适合单案试用",
      featureB: "7 天体验窗口",
      featureC: "快速验证工作流"
    },
    "monthly-pro": {
      title: "月度专业版",
      badge: "主推方案",
      description: "适合律所或个人律师高频使用，咨询额度更足，会员天数和优先升级能力也更完整。",
      featureA: "适合持续办案",
      featureB: "含优先升级能力",
      featureC: "可作为主账号常驻方案",
      featured: true
    },
    "credit-pack-100": {
      title: "加量包 100",
      badge: "按次补充",
      description: "适合已有基础账号、但最近案量集中时补充咨询额度，不影响现有使用习惯。",
      featureA: "高频案件补量",
      featureB: "无需额外会籍",
      featureC: "适合团队阶段冲刺"
    }
  };

  const preset = map[plan.code];
  if (preset) {
    return preset;
  }

  return {
    title: plan.name || plan.code,
    badge: "服务方案",
    description: plan.description || "围绕咨询、汇报和支付闭环提供额度支持。",
    featureA: `${plan.chat_credits} 次咨询额度`,
    featureB: plan.membership_days > 0 ? `${plan.membership_days} 天会籍` : "按次使用",
    featureC: "支持立即开通",
    featured: false
  };
}
