export type SubscriptionPlan = "normal" | "general" | "vip";

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  normal: "Normal",
  general: "General",
  vip: "VIP",
};

export const PLAN_PRICES_YEN: Record<SubscriptionPlan, number> = {
  normal: 0,
  general: 1600,
  vip: 2600,
};

export const NORMAL_PREVIEW_SECONDS = 60;

export function canAccessHighQuality(plan: SubscriptionPlan): boolean {
  return plan === "vip";
}

export function isAdRequired(plan: SubscriptionPlan): boolean {
  return plan === "general";
}

export function defaultPlaybackQuality(plan: SubscriptionPlan): "sd" | "hd" {
  return plan === "vip" ? "hd" : "sd";
}

export function normalizePlan(
  rawPlan: string | null | undefined,
): SubscriptionPlan {
  if (rawPlan === "general" || rawPlan === "vip") {
    return rawPlan;
  }
  return "normal";
}
