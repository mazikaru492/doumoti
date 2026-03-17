import { NextRequest, NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/security";
import { normalizePlan } from "@/lib/subscription";
import {
  attachStripeCustomer,
  findUserByStripeCustomerId,
  setUserPlan,
} from "@/lib/user-store";

export const runtime = "nodejs";

type StripeEvent = {
  id?: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

const processedEventTimestamps = new Map<string, number>();

function hasProcessedEvent(eventId: string): boolean {
  const now = Date.now();

  // Keep a rolling 24h dedupe window to limit replay and memory growth.
  for (const [id, timestamp] of processedEventTimestamps.entries()) {
    if (now - timestamp > 24 * 60 * 60 * 1000) {
      processedEventTimestamps.delete(id);
    }
  }

  if (processedEventTimestamps.has(eventId)) {
    return true;
  }
  processedEventTimestamps.set(eventId, now);
  return false;
}

type StripeSubscriptionObject = {
  customer?: unknown;
  status?: unknown;
  items?: {
    data?: Array<{
      price?: {
        id?: unknown;
      };
    }>;
  };
};

function extractPlanFromPriceId(
  priceId: unknown,
): "normal" | "general" | "vip" {
  const value = typeof priceId === "string" ? priceId : "";
  if (value.includes("vip")) {
    return "vip";
  }
  if (value.includes("general")) {
    return "general";
  }
  return "normal";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const stripeSignature = request.headers.get("stripe-signature");

  if (
    !stripeSignature ||
    !verifyStripeSignature(rawBody, stripeSignature, {
      toleranceSeconds: 300,
    })
  ) {
    return NextResponse.json(
      { error: "Invalid Stripe signature" },
      { status: 400 },
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (typeof event.id === "string" && hasProcessedEvent(event.id)) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  if (event.type === "checkout.session.completed") {
    const object = event.data.object;
    const customerId = object.customer;
    const userId = object.client_reference_id;
    const priceId =
      object.metadata && typeof object.metadata === "object"
        ? (object.metadata as Record<string, unknown>).price_id
        : null;

    if (typeof userId === "string" && typeof customerId === "string") {
      await attachStripeCustomer(userId, customerId);
      await setUserPlan(userId, normalizePlan(extractPlanFromPriceId(priceId)));
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const object = event.data.object as StripeSubscriptionObject;
    const customerId = object.customer;
    const status = object.status;
    const priceId = object.items?.data?.[0]?.price?.id;

    if (typeof customerId === "string") {
      const user = await findUserByStripeCustomerId(customerId);
      if (user) {
        if (status === "active" || status === "trialing") {
          await setUserPlan(
            user.userId,
            normalizePlan(extractPlanFromPriceId(priceId)),
          );
        } else {
          await setUserPlan(user.userId, "normal");
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
