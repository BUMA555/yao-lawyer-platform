import { Button, Input, Text, Textarea, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useRef, useState } from "react";

import { SectionCard } from "../../components/ui";
import { useCurrentUser } from "../../hooks/use-current-user";
import { apiGet, apiPost, createIdempotencyKey, hasAuthToken } from "../../services/api";
import type { DocumentListResponse, GeneratedDocument, GenerateDocumentResponse } from "../../types/api";
import { showErrorToast, showToast } from "../../utils/feedback";

const DOCUMENT_TYPES = [
  ["civil_complaint", "民事起诉状"],
  ["execution_application", "强制执行申请书"],
  ["civil_answer", "民事答辩状"],
  ["civil_appeal", "民事上诉状"],
  ["labor_arbitration", "劳动仲裁申请书"],
  ["evidence_catalog", "证据目录"]
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number][0];

type ValueEvent = {
  detail: {
    value: string;
  };
};

export default function DocumentsPage() {
  const { user, refreshUser } = useCurrentUser();
  const [documentType, setDocumentType] = useState<DocumentType>("civil_complaint");
  const [title, setTitle] = useState("");
  const [parties, setParties] = useState("");
  const [court, setCourt] = useState("");
  const [amount, setAmount] = useState("");
  const [facts, setFacts] = useState("");
  const [evidence, setEvidence] = useState("");
  const [claims, setClaims] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateDocumentResponse["document"] | null>(null);
  const [history, setHistory] = useState<GeneratedDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const pendingRequest = useRef<{ input: string; key: string } | null>(null);
  const generating = useRef(false);

  async function loadHistory() {
    if (!hasAuthToken()) {
      setHistory([]);
      setResult(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const response = await apiGet<DocumentListResponse>("/v1/documents");
      setHistory(response.documents || []);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }

  useDidShow(() => {
    void loadHistory();
  });

  async function generate() {
    if (generating.current) {
      return;
    }
    if (!hasAuthToken() || !user) {
      showToast("请先微信登录");
      void Taro.switchTab({ url: "/pages/profile/index" });
      return;
    }
    if (facts.trim().length < 12) {
      showToast("先写清事实经过");
      return;
    }

    const input = { document_type: documentType, title, parties, court, amount, facts, evidence, claims };
    const fingerprint = JSON.stringify(input);
    if (pendingRequest.current?.input !== fingerprint) {
      pendingRequest.current = {
        input: fingerprint,
        key: createIdempotencyKey("document", `${Date.now()}:${Math.random()}`)
      };
    }
    generating.current = true;
    setLoading(true);
    try {
      const response = await apiPost<GenerateDocumentResponse, Record<string, string>>("/v1/documents/generate", {
        ...input,
        idempotency_key: pendingRequest.current.key
      });
      setResult(response.document);
      await Promise.all([refreshUser(), loadHistory()]);
      showToast(response.document.model === "template-draft" ? "模板预览已生成" : "文书初稿已生成");
    } catch (error) {
      showErrorToast(error);
    } finally {
      generating.current = false;
      setLoading(false);
    }
  }

  async function copyContent() {
    if (!result?.content) {
      return;
    }
    await Taro.setClipboardData({ data: result.content });
    showToast("已复制全文");
  }

  return (
    <View className="law-page law-page--documents law-page--concise">
      <Text className="compact-page-title">生成文书</Text>
      <Text className="helper-text">每次生成消耗 1 点算力，先生成初稿，再核对姓名、案号、金额和附件。</Text>

      <SectionCard title="选择文书">
        <View className="document-type-grid">
          {DOCUMENT_TYPES.map(([value, label]) => (
            <Button
              key={value}
              className={`document-type-button ${documentType === value ? "document-type-button--active" : ""}`}
              onClick={() => setDocumentType(value)}
            >
              {label}
            </Button>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="填写案情" description="不确定的字段可以先留空，生成后会提示缺什么。">
        <View className="document-form-stack">
          <View className="document-field">
            <Text className="field-label">案件名称或案号</Text>
            <Input className="input-control" value={title} placeholder="例如：执行（2026）某号" onInput={(event: ValueEvent) => setTitle(event.detail.value)} />
          </View>
          <View className="document-field">
            <Text className="field-label">当事人</Text>
            <Textarea className="document-textarea" value={parties} placeholder="申请人、被申请人姓名或名称、住所地。" onInput={(event: ValueEvent) => setParties(event.detail.value)} />
          </View>
          <View className="document-field">
            <Text className="field-label">法院或仲裁机构</Text>
            <Input className="input-control" value={court} placeholder="例如：某某区人民法院" onInput={(event: ValueEvent) => setCourt(event.detail.value)} />
          </View>
          <View className="document-field">
            <Text className="field-label">金额</Text>
            <Input className="input-control" value={amount} placeholder="本金、利息、费用或暂计金额" onInput={(event: ValueEvent) => setAmount(event.detail.value)} />
          </View>
          <View className="document-field">
            <Text className="field-label">事实经过</Text>
            <Textarea className="document-textarea document-textarea--large" value={facts} maxlength={10000} placeholder="按时间写清人物、合同或裁判文书、付款、违约、目前状态。" onInput={(event: ValueEvent) => setFacts(event.detail.value)} />
          </View>
          <View className="document-field">
            <Text className="field-label">诉讼或执行请求</Text>
            <Textarea className="document-textarea" value={claims} placeholder="想让法院判什么、执行什么。" onInput={(event: ValueEvent) => setClaims(event.detail.value)} />
          </View>
          <View className="document-field">
            <Text className="field-label">证据和财产线索</Text>
            <Textarea className="document-textarea" value={evidence} placeholder="合同、转账、裁判文书、车辆、房产、账户、收款码等。" onInput={(event: ValueEvent) => setEvidence(event.detail.value)} />
          </View>
        </View>
        <Button className="action-button action-button--primary document-generate-button" disabled={loading} loading={loading} onClick={generate}>
          {user ? "生成文书初稿" : "微信登录后生成"}
        </Button>
      </SectionCard>

      {result ? (
        <SectionCard title={result.title} extra={<Button className="action-button action-button--secondary document-copy-button" onClick={copyContent}>复制全文</Button>}>
          {result.model === "template-draft" ? <Text className="document-warning">模板预览，未调用 AI 模型。</Text> : null}
          {result.missing_fields.length ? <Text className="document-warning">还缺：{result.missing_fields.join("；")}</Text> : null}
          <Text className="preformatted-text document-content">{result.content}</Text>
          <Text className="document-fineprint">当前为文书初稿，提交前请核对全部事实、金额、案号和附件。</Text>
        </SectionCard>
      ) : null}

      {user ? (
        <SectionCard title="我的文书" extra={<Button className="action-button action-button--ghost document-copy-button" loading={historyLoading} disabled={historyLoading} onClick={loadHistory}>刷新</Button>}>
          {historyError ? <Text className="helper-text">暂时无法加载，请刷新重试。</Text> : null}
          {!historyLoading && !historyError && !history.length ? <Text className="helper-text">暂无文书</Text> : null}
          <View className="document-history-list">
            {history.map((document) => (
              <Button key={document.id} className="document-history-row" onClick={() => setResult(document)}>
                <Text className="document-history-title">{document.title}</Text>
                <Text className="helper-text">{new Date(document.created_at).toLocaleDateString("zh-CN")}{document.model === "template-draft" ? " · 模板预览" : ""}</Text>
              </Button>
            ))}
          </View>
        </SectionCard>
      ) : null}
    </View>
  );
}
