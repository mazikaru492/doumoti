import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const priceId = formData.get("priceId") as string;
  const tier = formData.get("tier") as string;

  if (!priceId || !tier) {
    return NextResponse.redirect(
      new URL("/pricing?error=invalid_request", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?redirect=/pricing", request.url),
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return NextResponse.redirect(
      new URL("/pricing?error=stripe_not_configured", request.url),
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "subscription",
          success_url: `${baseUrl}/pricing?success=true`,
          cancel_url: `${baseUrl}/pricing?canceled=true`,
          client_reference_id: user.id,
          customer_email: user.email || "",
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          "metadata[user_id]": user.id,
          "metadata[tier]": tier,
          "metadata[price_id]": priceId,
        }).toString(),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Stripe API error:", errorData);
      return NextResponse.redirect(
        new URL("/pricing?error=stripe_error", request.url),
      );
    }

    const session = await response.json();

    if (!session.url) {
      return NextResponse.redirect(
        new URL("/pricing?error=no_checkout_url", request.url),
      );
    }

    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.redirect(
      new URL("/pricing?error=checkout_failed", request.url),
    );
  }
}
