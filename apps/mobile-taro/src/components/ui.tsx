import { Text, View } from "@tarojs/components";
import type { PropsWithChildren, ReactNode } from "react";

export interface HeroStat {
  label: string;
  value: string;
  note?: string;
}

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  actionsClassName?: string;
  stats?: HeroStat[];
  footer?: ReactNode;
  sticker?: string;
  aside?: ReactNode;
  className?: string;
}

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  extra?: ReactNode;
  tone?: "default" | "accent" | "muted";
  tag?: string;
  className?: string;
}

interface BadgeProps {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

interface StitchTopBarProps {
  active?: string;
  action?: string;
}

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  actionsClassName,
  stats = [],
  footer,
  sticker,
  aside,
  className
}: PageHeroProps) {
  return (
    <View className={joinClassNames("page-hero", className)}>
      {sticker ? <Text className="page-hero__sticker">{sticker}</Text> : null}
      <View className="page-hero__grid">
        <View className="page-hero__content">
          <Text className="page-hero__eyebrow">{eyebrow}</Text>
          <Text className="page-hero__title">{title}</Text>
          <Text className="page-hero__description">{description}</Text>
          {actions ? <View className={joinClassNames("page-hero__actions", actionsClassName)}>{actions}</View> : null}
          {stats.length ? (
            <View className="metric-grid">
              {stats.map((item) => (
                <View key={`${item.label}-${item.value}`} className="metric-card">
                  <Text className="metric-card__label">{item.label}</Text>
                  <Text className="metric-card__value">{item.value}</Text>
                  {item.note ? <Text className="metric-card__note">{item.note}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
          {footer ? <View className="page-hero__footer">{footer}</View> : null}
        </View>

        {aside ? <View className="page-hero__aside">{aside}</View> : null}
      </View>
    </View>
  );
}

export function SectionCard({ title, description, extra, children, tone = "default", tag, className }: SectionCardProps) {
  return (
    <View
      className={joinClassNames(
        "surface-card",
        tone === "accent" && "surface-card--accent",
        tone === "muted" && "surface-card--muted",
        className
      )}
    >
      {tag ? <Text className="surface-card__tag">{tag}</Text> : null}
      <View className="section-heading">
        <View className="section-heading__body">
          <Text className="section-heading__title">{title}</Text>
          {description ? <Text className="section-heading__description">{description}</Text> : null}
        </View>
        {extra ? <View className="section-heading__extra">{extra}</View> : null}
      </View>
      <View className="section-body">{children}</View>
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return <Text className={joinClassNames("badge", `badge--${tone}`)}>{label}</Text>;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View className="empty-state">
      <Text className="empty-state__title">{title}</Text>
      <Text className="empty-state__description">{description}</Text>
      {action ? <View className="empty-state__action">{action}</View> : null}
    </View>
  );
}

export function StitchTopBar({ active = "POW! 法律正义", action = "立即咨询" }: StitchTopBarProps) {
  return (
    <View className="stitch-topbar">
      <View className="stitch-topbar__brand-block">
        <Text className="stitch-topbar__brand">YAO LAWYER</Text>
        <Text className="stitch-topbar__subtitle">Digital Law Chamber</Text>
      </View>
      <View className="stitch-topbar__right">
        <Text className="stitch-topbar__active">{active}</Text>
        <Text className="stitch-topbar__action">{action}</Text>
      </View>
    </View>
  );
}
