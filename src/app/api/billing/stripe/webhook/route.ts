import { NextRequest, NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/security";
import { normalizePlan } from "@/lib/subscription";
import {
  attachStripeCustomer,
  findUserByStripeCustomerId,
  setUserPlan,
} from "@/lib/user-store";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

type StripeEvent = {
  id?: string;
  type: string;
  created?: number;
  data: {
    object: Record<string, unknown>;
  };
};

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

type StripeInvoiceObject = {
  customer?: unknown;
  subscription?: unknown;
  status?: unknown;
  lines?: {
    data?: Array<{
      price?: {
        id?: unknown;
      };
    }>;
  };
};

async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("stripe_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return true;
  }

  const { error } = await admin.from("stripe_events").insert({
    event_id: eventId,
    processed_at: new Date().toISOString(),
  });

  return error !== null;
}

function extractPlanFromMetadata(
  metadata: unknown,
): "normal" | "general" | "vip" {
  if (!metadata || typeof metadata !== "object") {
    return "normal";
  }
  const meta = metadata as Record<string, unknown>;

  if (meta.tier === "VIP" || meta.tier === "vip") {
    return "vip";
  }
  if (meta.tier === "GENERAL" || meta.tier === "general") {
    return "general";
  }

  const priceId = meta.price_id;
  if (typeof priceId === "string") {
    if (priceId.toLowerCase().includes("vip")) {
      return "vip";
    }
    if (priceId.toLowerCase().includes("general")) {
      return "general";
    }
  }

  return "normal";
}

function extractPlanFromPriceId(
  priceId: unknown,
): "normal" | "general" | "vip" {
  const value = typeof priceId === "string" ? priceId.toLowerCase() : "";
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
    console.error("[Stripe Webhook] Invalid signature");
    return NextResponse.json(
      { error: "Invalid Stripe signature" },
      { status: 400 },
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    console.error("[Stripe Webhook] Invalid JSON payload");
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  if (typeof event.id === "string" && (await hasProcessedEvent(event.id))) {
    console.log(`[Stripe Webhook] Event ${event.id} already processed`);
    return NextResponse.json({ received: true, deduplicated: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const object = event.data.object;
        const customerId = object.customer;
        const userId = object.client_reference_id;
        const plan = extractPlanFromMetadata(object.metadata);

        console.log(
          `[Stripe Webhook] Checkout completed: userId=${userId}, customerId=${customerId}, plan=${plan}`,
        );

        if (typeof userId === "string" && typeof customerId === "string") {
          await attachStripeCustomer(userId, customerId);
          await setUserPlan(userId, normalizePlan(plan));
          console.log(`[Stripe Webhook] User ${userId} upgraded to ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const object = event.data.object as StripeSubscriptionObject;
        const customerId = object.customer;
        const status = object.status;
        const priceId = object.items?.data?.[0]?.price?.id;

        console.log(
          `[Stripe Webhook] Subscription ${event.type}: customerId=${customerId}, status=${status}`,
        );

        if (typeof customerId === "string") {
          const user = await findUserByStripeCustomerId(customerId);
          if (user) {
            if (status === "active" || status === "trialing") {
              const plan = extractPlanFromPriceId(priceId);
              await setUserPlan(user.userId, normalizePlan(plan));
              console.log(
                `[Stripe Webhook] User ${user.userId} subscription active: ${plan}`,
              );
            } else {
              await setUserPlan(user.userId, "normal");
              console.log(
                `[Stripe Webhook] User ${user.userId} subscription ${status}, downgraded to normal`,
              );
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const object = event.data.object as StripeInvoiceObject;
        const customerId = object.customer;
        const priceId = object.lines?.data?.[0]?.price?.id;

        console.log(
          `[Stripe Webhook] Invoice payment succeeded: customerId=${customerId}`,
        );

        if (typeof customerId === "string") {
          const user = await findUserByStripeCustomerId(customerId);
          if (user && priceId) {
            const plan = extractPlanFromPriceId(priceId);
            await setUserPlan(user.userId, normalizePlan(plan));
            console.log(
              `[Stripe Webhook] User ${user.userId} payment succeeded: ${plan}`,
            );
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const object = event.data.object as StripeInvoiceObject;
        const customerId = object.customer;

        console.log(
          `[Stripe Webhook] Invoice payment failed: customerId=${customerId}`,
        );

        if (typeof customerId === "string") {
          const user = await findUserByStripeCustomerId(customerId);
          if (user) {
            console.log(
              `[Stripe Webhook] User ${user.userId} payment failed - consider sending notification`,
            );
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing event:`, error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
