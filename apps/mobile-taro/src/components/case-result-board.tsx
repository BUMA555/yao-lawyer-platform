import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";

import type { ChatRespondPayload } from "../types/api";
import { buildResultBoard, formatRiskLevel } from "../utils/format";

interface CaseResultBoardProps {
  report: ChatRespondPayload;
  footer?: ReactNode;
}

function ResultColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <View className="info-card">
      <Text className="info-card__label">{title}</Text>
      <View className="list-block" style={{ marginTop: "12px" }}>
        {items.map((item, index) => (
          <View key={`${title}-${index}-${item}`} className="list-item">
            <Text className="list-item__index">{index + 1}</Text>
            <Text className="list-item__text">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CaseResultBoard({ report, footer }: CaseResultBoardProps) {
  const board = buildResultBoard(report);

  return (
    <>
      <View className="result-stage">
        <Text className="result-stage__tag">{report.status === "queued" ? "RECHECK" : "RESULT READY"}</Text>
        <View className="result-stage__seal">
          <Text className="result-stage__label">法律风险等级</Text>
          <Text className="result-stage__value">{formatRiskLevel(report.risk_level)}</Text>
          <Text className="result-stage__note">{board.riskNote}</Text>
        </View>
      </View>

      <View className="result-story-grid">
        <View className="result-story-card result-story-card--primary">
          <Text className="result-story-card__title">核心结论</Text>
          <Text className="result-story-card__body">{board.summary}</Text>
        </View>

        <View className="result-story-card result-story-card--alert">
          <Text className="result-story-card__title">当前最危险点</Text>
          <Text className="result-story-card__body">{board.dangerPoint}</Text>
        </View>
      </View>

      <View className="summary-grid result-summary-grid">
        <ResultColumn title="优先补齐的证据" items={board.evidenceGaps} />
        <ResultColumn title="48 小时动作清单" items={board.actionPlan} />
        <ResultColumn title="更适合的推进路径" items={board.routeSuggestions} />
      </View>

      <View className="result-caution">
        <Text className="result-caution__label">先别这么干</Text>
        <View className="list-block danger-list">
          {board.notRecommended.map((item, index) => (
            <View key={`${index}-${item}`} className="list-item">
              <Text className="list-item__index">{index + 1}</Text>
              <Text className="list-item__text">{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {footer ? <View style={{ marginTop: "16px" }}>{footer}</View> : null}
    </>
  );
}
