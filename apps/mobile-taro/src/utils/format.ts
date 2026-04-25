import type { ChatRespondPayload, LoginUser, Plan } from "../types/api";

const LANE_LABELS: Record<string, string> = {
  "civil-commercial": "民商争议",
  "company-control": "公司控制权",
  labor: "劳动争议",
  "fraud-boundary": "刑民交叉"
};

const RISK_LABELS: Record<string, string> = {
  R1: "高风险核验",
  R2: "重点核验",
  R3: "常规分析"
};

const STATUS_LABELS: Record<string, string> = {
  ok: "已生成建议",
  queued: "人工核验排队中"
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
    summary: "从你给的事实看，这更像民商争议。核心不是先喊态度，而是先把合同履行链和付款链补齐。",
    dangerPoint: "你现在最大的风险不是“能不能赢”，而是关键证据链可能断在履约确认、对账或付款往来。",
    evidenceGaps: ["合同签订与履行确认记录", "对账单、催款记录、发票", "对方认可欠款或拖延付款的明确表述"],
    routeSuggestions: ["先整理履约与付款证据目录", "评估先保全还是先起诉", "必要时先做送达和催收留痕"]
  },
  labor: {
    summary: "这更像劳动争议。先抓劳动关系、工资流和在岗痕迹，不要被情绪牵着走。",
    dangerPoint: "最危险的不是态度输赢，而是劳动关系和离职事实说不清，后续仲裁会很被动。",
    evidenceGaps: ["劳动合同、入职/在岗证明", "工资流水、考勤排班、工作群记录", "离职通知、谈话留痕、解除依据"],
    routeSuggestions: ["先锁定劳动关系证据", "同步梳理仲裁请求与证据目录", "必要时保留录音与书面确认"]
  },
  "company-control": {
    summary: "这类更偏公司控制权争议。第一优先不是对抗，而是先控章、控账、控后台权限。",
    dangerPoint: "最危险的是权限被改、资料被删、财务或印章被单方控制，一旦晚一步会非常被动。",
    evidenceGaps: ["公章、网银、邮箱、后台权限现状截图", "股东决议、授权链、任命文件", "近期异常操作与权限变更留痕"],
    routeSuggestions: ["先做权限与资料保全", "评估治理动作与诉前保全顺序", "必要时先固定对方异常操作证据"]
  },
  "fraud-boundary": {
    summary: "这更像刑民边界问题。先判断证据链能不能支撑，再决定是否往报警方向走。",
    dangerPoint: "危险不在“报不报警”，而在把民间借贷、合作失败和诈骗定性混为一谈。",
    evidenceGaps: ["对方承诺用途与实际用途不一致证据", "资金流向、转账备注、还款承诺", "诱导陈述、虚假身份或虚假承诺留痕"],
    routeSuggestions: ["先做刑民边界核验", "补齐借贷与诈骗区分证据", "先固化民事证据再评估报警时机"]
  }
};

const RISK_NOTES: Record<string, string> = {
  R1: "存在资产转移、证据灭失或关键节点临近风险，建议优先走核验与保全。",
  R2: "已出现程序或证据风险，继续拖延会更被动。",
  R3: "暂时没有爆点，但仍建议先把证据链和动作顺序排清楚。"
};

export const HOME_SCENARIOS = [
  {
    code: "fraud-boundary",
    title: "借钱不还",
    subtitle: "先判断更像民事借贷还是诈骗",
    prompt: "借给熟人一笔钱，对方一直拖着不还。我有转账记录和聊天记录，但不确定该按借贷还是诈骗处理。"
  },
  {
    code: "labor",
    title: "被辞退 / 欠薪",
    subtitle: "先看仲裁核心点和证据缺口",
    prompt: "公司突然辞退我，还拖着工资和补偿不给。我有工资流水和工作群记录，仲裁前该先准备什么？"
  },
  {
    code: "civil-commercial",
    title: "合同欠款",
    subtitle: "先判断起诉还是保全更稳",
    prompt: "客户拖欠合同款，已有对账和催款记录，但一直拖延。现在先起诉还是先保全更合适？"
  },
  {
    code: "evidence",
    title: "证据整理",
    subtitle: "先把证据目录拉平再推进",
    prompt: "我有聊天截图、合同照片和转账记录，但很乱。想先知道哪些最关键，还缺什么。"
  }
] as const;

export const HOME_MISTAKES = [
  "借贷纠纷证据不足时，不要先冲“诈骗定性”。",
  "劳动争议别先发情绪长文，先保工资、考勤和在岗痕迹。",
  "合同欠款别急着摊牌，先把时间线和证据目录拉平。",
  "高风险场景先保全、先留痕，别一上来就公开对抗。"
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
  if (!value) return "未开通会员";
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
  if (!user) return "登录后可查看算力余额、结果记录和分享奖励。";
  return `当前可用 ${getQuotaTotal(user)} 点算力，另有 ${user.free_report_quota} 次报告权益。`;
}

function getLaneBoard(value: string) {
  return RESULT_BOARD_BY_LANE[value] || RESULT_BOARD_BY_LANE["civil-commercial"];
}

export function buildResultBoard(report: ChatRespondPayload) {
  const laneBoard = getLaneBoard(report.lane);

  return {
    summary: laneBoard.summary,
    riskNote: RISK_NOTES[report.risk_level] || "先把事实链、证据链和程序节点排清，再决定走哪条路。",
    dangerPoint: laneBoard.dangerPoint,
    evidenceGaps: laneBoard.evidenceGaps,
    actionPlan: report.next_actions.length
      ? report.next_actions
      : ["先保留现有证据原件", "先拉完整时间线", "先暂停情绪化动作"],
    routeSuggestions: laneBoard.routeSuggestions,
    notRecommended: report.not_recommended.length
      ? report.not_recommended
      : ["证据不全前不要公开定性", "程序节点不清前不要贸然起诉或报警"]
  };
}

export function buildShareCopy(report: ChatRespondPayload | null) {
  if (!report) {
    return "我刚问了姚律师，它不是空泛聊天，而是直接拆风险、证据缺口和48小时动作。你也可以先问一句。";
  }

  const board = buildResultBoard(report);
  return [
    `我刚问了姚律师，当前更像：${formatLane(report.lane)}。`,
    `最危险点：${board.dangerPoint}`,
    `48小时先做：${board.actionPlan[0] || "先把证据和时间线拉清"}`,
    "先问清楚，再决定要不要往下走，会更稳。"
  ].join("\n");
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
    "优先补齐的证据",
    evidenceGaps,
    "",
    "48小时动作清单",
    nextActions,
    "",
    "当前更适合的推进路径",
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
      title: "体验算力包",
      badge: "旧方案兼容",
      description: "兼容旧版本的体验包，当前按算力方案展示。",
      featureA: "适合单次问题",
      featureB: "短期体验",
      featureC: "适合先问一轮"
    },
    "monthly-pro": {
      title: "月度算力版",
      badge: "旧方案兼容",
      description: "兼容旧版本的月度方案，后续会升级为 9.9 月付主方案。",
      featureA: "适合持续追问",
      featureB: "含月度有效期",
      featureC: "推荐平滑迁移",
      featured: true
    },
    "monthly-9-9": {
      title: "9.9 月付",
      badge: "主推入口",
      description: "低门槛开通姚律师月度算力，适合持续追问、生成基础结果卡和复盘最近问题。",
      featureA: "适合普通用户常驻",
      featureB: "每月补充基础算力",
      featureC: "冷启动主推方案",
      featured: true
    },
    "credit-pack-30": {
      title: "算力包 30",
      badge: "轻量补充",
      description: "适合一次复杂问题或短期集中追问，用完再补，不改变月付状态。",
      featureA: "适合临时追问",
      featureB: "按量补充",
      featureC: "适合试用后加量"
    },
    "credit-pack-100": {
      title: "算力包 100",
      badge: "高频补充",
      description: "适合连续咨询、深度分析和材料整理较多的用户。",
      featureA: "高峰期补量",
      featureB: "不改月付状态",
      featureC: "适合高频使用"
    }
  };

  const preset = map[plan.code];
  if (preset) {
    return preset;
  }

  return {
    title: plan.name || plan.code,
    badge: "算力方案",
    description: plan.description || "围绕问答、结果卡和深度分析提供算力支持。",
    featureA: `${plan.chat_credits} 点算力`,
    featureB: plan.membership_days > 0 ? `${plan.membership_days} 天有效` : "按量使用",
    featureC: "支持立即开通",
    featured: false
  };
}
