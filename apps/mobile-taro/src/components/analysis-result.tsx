import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";

import type { ChatRespondPayload } from "../types/api";
import { formatLane, formatRiskLevel, formatStatus } from "../utils/format";
import { Badge } from "./ui";

interface AnalysisResultProps {
  result: ChatRespondPayload;
  footer?: ReactNode;
}

function ActionList({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <View className="info-card">
      <Text className="info-card__label">{title}</Text>
      <View className={`list-block${danger ? " danger-list" : ""}`} style={{ marginTop: "12px" }}>
        {items.map((item, index) => (
          <View key={`${index}-${item}`} className="list-item">
            <Text className="list-item__index">{index + 1}</Text>
            <Text className="list-item__text">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AnalysisResult({ result, footer }: AnalysisResultProps) {
  return (
    <>
      <View className="chip-row">
        <Badge label={formatStatus(result.status)} tone={result.status === "queued" ? "warning" : "success"} />
        <Badge label={formatLane(result.lane)} tone="accent" />
        <Badge
          label={formatRiskLevel(result.risk_level)}
          tone={result.risk_level === "R1" ? "danger" : result.risk_level === "R2" ? "warning" : "neutral"}
        />
      </View>

      {result.status === "queued" ? (
        <View className="notice-panel notice-panel--warning" style={{ marginTop: "16px" }}>
          <Text className="notice-panel__title">当前进入高风险核验队列</Text>
          <Text className="notice-panel__text">
            {result.eta_seconds
              ? `预计 ${Math.max(1, Math.round(result.eta_seconds / 60))} 分钟内给出更稳的复核结果。`
              : "建议先走人工复核，避免关键节点误判。"}
          </Text>
        </View>
      ) : null}

      <View className="insight-grid">
        <View className="insight-card">
          <Text className="insight-card__eyebrow">JUDGE VERSION</Text>
          <Text className="insight-card__title">法官版</Text>
          <Text className="insight-card__body">{result.judge_version}</Text>
        </View>

        <View className="insight-card">
          <Text className="insight-card__eyebrow">CLIENT VERSION</Text>
          <Text className="insight-card__title">客户版</Text>
          <Text className="insight-card__body">{result.client_version}</Text>
        </View>

        <View className="insight-card">
          <Text className="insight-card__eyebrow">TEAM VERSION</Text>
          <Text className="insight-card__title">团队版</Text>
          <Text className="insight-card__body">{result.team_version}</Text>
        </View>
      </View>

      <View className="summary-grid" style={{ marginTop: "16px" }}>
        <ActionList title="下一步动作" items={result.next_actions} />
        <ActionList title="暂不建议" items={result.not_recommended} danger />
      </View>

      {footer ? <View style={{ marginTop: "16px" }}>{footer}</View> : null}
    </>
  );
}
