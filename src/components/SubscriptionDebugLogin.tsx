"use client";

import { useState } from "react";

const DEMO_USERS = [
  { userId: "demo-normal", plan: "normal", label: "Normal (無料)" },
  { userId: "demo-general", plan: "general", label: "General (1600円/月)" },
  { userId: "demo-vip", plan: "vip", label: "VIP (2600円/月)" },
] as const;

export default function SubscriptionDebugLogin() {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const login = async (userId: string, plan: string) => {
    setLoadingId(userId);
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, plan }),
      });

      if (!response.ok) {
        return;
      }
      window.location.reload();
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="hidden lg:flex items-center gap-2">
      {DEMO_USERS.map((demo) => (
        <button
          key={demo.userId}
          onClick={() => login(demo.userId, demo.plan)}
          disabled={loadingId !== null}
          className="text-[11px] px-2 py-1 rounded-md border border-border/60 text-muted hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50"
          type="button"
        >
          {loadingId === demo.userId ? "切替中..." : demo.label}
        </button>
      ))}
    </div>
  );
}
