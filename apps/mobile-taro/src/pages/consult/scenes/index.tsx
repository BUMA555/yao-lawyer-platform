import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { PageHero, SectionCard } from "../../../components/ui";
import { clearChatSessionId, clearCurrentCaseId, clearLastConsultResult, createEmptyCaseDraft, setCaseDraft } from "../../../services/api";
import { HOME_SCENARIOS } from "../../../utils/format";

export default function ConsultScenesPage() {
  function chooseScenario(payload: { code: string; title: string; prompt: string }) {
    const next = {
      ...createEmptyCaseDraft(payload.code),
      scene: payload.code,
      title: payload.title,
      facts: payload.prompt
    };

    setCaseDraft(next);
    clearCurrentCaseId();
    clearChatSessionId();
    clearLastConsultResult();
    void Taro.navigateTo({ url: "/pages/consult/intake/index" });
  }

  return (
    <View className="law-page law-page--consult">
      <PageHero
        className="page-hero--consult"
        eyebrow="STEP 1"
        sticker="CASE SCENE"
        title="先选案件场景"
        description="选择最接近的场景后，会自动初始化案件草稿并进入结构化录入。"
      />

      <SectionCard title="场景入口" description="点击后将预填标题和事实模板。" tag="SCENES">
        <View className="scenario-grid">
          {HOME_SCENARIOS.map((item) => (
            <View
              key={item.code}
              className="scenario-card"
              onClick={() => chooseScenario({ code: item.code, title: item.title, prompt: item.prompt })}
            >
              <Text className="scenario-card__flag">{item.title.slice(0, 2)}</Text>
              <Text className="scenario-card__title">{item.title}</Text>
              <Text className="scenario-card__subtitle">{item.subtitle}</Text>
            </View>
          ))}
        </View>

        <View className="button-row" style={{ marginTop: "16px" }}>
          <Button className="action-button action-button--ghost" onClick={() => void Taro.navigateBack()}>
            返回案件入口
          </Button>
        </View>
      </SectionCard>
    </View>
  );
}
