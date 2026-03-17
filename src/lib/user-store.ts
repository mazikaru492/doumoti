import "server-only";

import { cache } from "react";
import { normalizePlan, type SubscriptionPlan } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type Tier = "NORMAL" | "GENERAL" | "VIP";

type UserRecord = {
  userId: string;
  plan: SubscriptionPlan;
  stripeCustomerId?: string;
};

type ProfileRow = {
  id: string;
  subscription_tier: Tier;
  stripe_customer_id: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function tierToPlan(tier: string | null | undefined): SubscriptionPlan {
  if (tier === "VIP") {
    return "vip";
  }
  if (tier === "GENERAL") {
    return "general";
  }
  return "normal";
}

function planToTier(plan: SubscriptionPlan): Tier {
  if (plan === "vip") {
    return "VIP";
  }
  if (plan === "general") {
    return "GENERAL";
  }
  return "NORMAL";
}

const fetchProfileByUserId = cache(
  async (userId: string): Promise<UserRecord> => {
    if (!isUuid(userId)) {
      return {
        userId,
        plan: "normal",
      };
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id,subscription_tier,stripe_customer_id")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (error || !profile) {
      return {
        userId,
        plan: "normal",
      };
    }

    return {
      userId,
      plan: tierToPlan(profile.subscription_tier),
      stripeCustomerId: profile.stripe_customer_id ?? undefined,
    };
  },
);

export async function getOrCreateUser(userId: string): Promise<UserRecord> {
  if (!isUuid(userId)) {
    return {
      userId,
      plan: "normal",
    };
  }

  const admin = createSupabaseAdminClient();
  await admin.from("profiles").upsert(
    {
      id: userId,
      subscription_tier: "NORMAL",
    },
    {
      onConflict: "id",
      ignoreDuplicates: true,
    },
  );

  return fetchProfileByUserId(userId);
}

export async function setUserPlan(
  userId: string,
  plan: string,
): Promise<UserRecord> {
  const normalizedPlan = normalizePlan(plan);

  if (!isUuid(userId)) {
    return {
      userId,
      plan: normalizedPlan,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        subscription_tier: planToTier(normalizedPlan),
      },
      {
        onConflict: "id",
      },
    )
    .select("id,subscription_tier,stripe_customer_id")
    .single<ProfileRow>();

  if (error || !data) {
    return {
      userId,
      plan: "normal",
    };
  }

  return {
    userId: data.id,
    plan: tierToPlan(data.subscription_tier),
    stripeCustomerId: data.stripe_customer_id ?? undefined,
  };
}

export async function attachStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  if (!isUuid(userId)) {
    return;
  }

  const admin = createSupabaseAdminClient();
  await admin.from("profiles").upsert(
    {
      id: userId,
      stripe_customer_id: stripeCustomerId,
    },
    {
      onConflict: "id",
    },
  );
}

export async function findUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<UserRecord | undefined> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,subscription_tier,stripe_customer_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle<ProfileRow>();

  if (error || !data) {
    return undefined;
  }

  return {
    userId: data.id,
    plan: tierToPlan(data.subscription_tier),
    stripeCustomerId: data.stripe_customer_id ?? undefined,
  };
}
