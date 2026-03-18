import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle();

  const tier = profile?.subscription_tier ?? "NORMAL";

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-foreground">
      <h1 className="text-2xl sm:text-3xl font-semibold text-white">
        マイページ
      </h1>
      <p className="mt-4 text-zinc-300">ログイン済みユーザー専用ページです。</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 border-b border-white/10 pb-3">
            <dt className="text-zinc-400">ユーザーID</dt>
            <dd className="font-mono text-zinc-100 text-xs sm:text-sm break-all sm:break-normal sm:truncate sm:max-w-[65%]">
              {user.id}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <dt className="text-zinc-400">Subscription Tier</dt>
            <dd className="rounded-full bg-red-500/15 px-3 py-1 font-semibold text-red-200 w-fit">
              {tier}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
