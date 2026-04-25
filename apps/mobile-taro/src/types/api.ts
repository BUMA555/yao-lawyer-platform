export interface CreateSessionResponse {
  request_id: string;
  session_id: string;
  lane: string;
  risk_level: string;
}

export interface ChatRespondPayload {
  status: string;
  lane: string;
  risk_level: string;
  model: string;
  judge_version: string;
  client_version: string;
  team_version: string;
  next_actions: string[];
  not_recommended: string[];
  queued_ticket_id?: string | null;
  eta_seconds?: number | null;
}

export interface ChatRespondResponse {
  request_id: string;
  data: ChatRespondPayload;
}

export interface EscalateHumanResponse {
  request_id: string;
  ticket_id: string;
  status: string;
}

export interface Plan {
  code: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  chat_credits: number;
  membership_days: number;
}

export interface PlanListResponse {
  request_id: string;
  plans: Plan[];
}

export interface CreateOrderResponse {
  request_id: string;
  order_id: string;
  plan_code: string;
  amount_cents: number;
  status: string;
  channel: string;
}

export interface PrepayResponse {
  request_id: string;
  order_id: string;
  channel: string;
  prepay_payload: Record<string, unknown>;
}

export interface SendCodeResponse {
  request_id: string;
  expires_at: string;
  debug_code?: string | null;
}

export interface LoginUser {
  id: string;
  mobile: string;
  invite_code: string;
  free_chat_quota: number;
  free_report_quota: number;
  paid_chat_credits: number;
  membership_expires_at: string | null;
}

export interface LoginResponse {
  request_id: string;
  token: string;
  user: LoginUser;
}

export interface CaseRecord {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  lane: string;
  status: string;
  priority: string;
  source: string;
  linked_session_ids: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export type CaseUrgency = "low" | "normal" | "high" | "critical";

export interface CaseDraft {
  scene: string;
  title: string;
  facts: string;
  evidence: string;
  goal: string;
  urgency: CaseUrgency;
  updated_at: string;
}

export interface MeResponse {
  request_id: string;
  user?: LoginUser;
  data?: LoginUser;
}

export interface CaseDetailResponse {
  request_id: string;
  case: CaseRecord;
}

export interface CaseListResponse {
  request_id: string;
  cases: CaseRecord[];
}

export interface BindReferralResponse {
  request_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
}

export interface ClaimRewardResponse {
  request_id: string;
  claimed_count: number;
  granted_chat_credits: number;
}
