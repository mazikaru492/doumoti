import { normalizePlan, type SubscriptionPlan } from "@/lib/subscription";

type UserRecord = {
  userId: string;
  plan: SubscriptionPlan;
  stripeCustomerId?: string;
};

const userStore = new Map<string, UserRecord>([
  ["demo-normal", { userId: "demo-normal", plan: "normal" }],
  ["demo-general", { userId: "demo-general", plan: "general" }],
  ["demo-vip", { userId: "demo-vip", plan: "vip" }],
]);

export function getOrCreateUser(userId: string): UserRecord {
  const existing = userStore.get(userId);
  if (existing) {
    return existing;
  }

  const created: UserRecord = {
    userId,
    plan: "normal",
  };
  userStore.set(userId, created);
  return created;
}

export function setUserPlan(userId: string, plan: string): UserRecord {
  const user = getOrCreateUser(userId);
  const updated: UserRecord = {
    ...user,
    plan: normalizePlan(plan),
  };
  userStore.set(userId, updated);
  return updated;
}

export function attachStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): void {
  const user = getOrCreateUser(userId);
  userStore.set(userId, {
    ...user,
    stripeCustomerId,
  });
}

export function findUserByStripeCustomerId(
  stripeCustomerId: string,
): UserRecord | undefined {
  for (const user of userStore.values()) {
    if (user.stripeCustomerId === stripeCustomerId) {
      return user;
    }
  }
  return undefined;
}
