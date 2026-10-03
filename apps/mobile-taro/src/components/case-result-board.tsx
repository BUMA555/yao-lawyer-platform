import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";

import type { ChatRespondPayload } from "../types/api";
import { buildResultBoard, formatRiskLevel } from "../utils/format";
import { Disclosure } from "./ui";

interface CaseResultBoardProps {
  report: ChatRespondPayload;
  footer?: ReactNode;
}

function ResultColumn({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;

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
        <Text className="result-stage__tag">{report.status === "queued" ? "等待复核" : "结果已生成"}</Text>
        <View className="result-stage__seal">
          <Text className="result-stage__label">当前风险</Text>
          <Text className="result-stage__value">{formatRiskLevel(report.risk_level)}</Text>
        </View>
      </View>

      <View className="result-story-grid">
        <View className="result-story-card result-story-card--primary">
          <Text className="result-story-card__title">当前判断</Text>
          <Text className="result-story-card__body">{board.summary}</Text>
        </View>

        <View className="result-story-card result-story-card--alert">
          <Text className="result-story-card__title">重点风险</Text>
          <Text className="result-story-card__body">{board.dangerPoint}</Text>
        </View>
      </View>

      <View className="summary-grid result-summary-grid">
        <ResultColumn title="下一步" items={board.actionPlan} />
        <ResultColumn title="待补证据" items={board.evidenceGaps} />
      </View>

      {board.knownFacts.length || board.inferences.length || board.toVerify.length ? (
        <Disclosure key={report.report_id || report.summary} title="事实与判断依据">
          <View className="summary-grid result-summary-grid">
            <ResultColumn title="已知事实" items={board.knownFacts} />
            <ResultColumn title="推定判断" items={board.inferences} />
            <ResultColumn title="待核验" items={board.toVerify} />
            <ResultColumn title="争点与路径" items={board.routeSuggestions} />
          </View>
        </Disclosure>
      ) : null}

      {!board.knownFacts.length && !board.inferences.length && !board.toVerify.length ? (
        <Disclosure title="争点与路径">
          <ResultColumn title="争点与路径" items={board.routeSuggestions} />
        </Disclosure>
      ) : null}

      {board.urgentFlags.length ? (
        <View className="result-caution">
          <Text className="result-caution__label">紧急提示</Text>
          <View className="list-block danger-list">
            {board.urgentFlags.map((item, index) => (
              <View key={`urgent-${index}-${item}`} className="list-item">
                <Text className="list-item__index">{index + 1}</Text>
                <Text className="list-item__text">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="result-caution">
        <Text className="result-caution__label">先别这么做</Text>
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
