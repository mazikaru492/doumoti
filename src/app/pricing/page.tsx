import { createSupabaseServerClient } from "@/utils/supabase/server";
import {
  Check,
  Crown,
  Star,
  Zap,
  X,
  AlertCircle,
  PartyPopper,
} from "lucide-react";
import Link from "next/link";

type Tier = "NORMAL" | "GENERAL" | "VIP";

interface PageProps {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    error?: string;
  }>;
}

const plans = [
  {
    id: "normal",
    name: "無料プラン",
    tier: "NORMAL" as Tier,
    price: 0,
    priceLabel: "¥0",
    period: "永久無料",
    description: "基本的な動画コンテンツを無料で視聴",
    icon: Zap,
    features: [
      "無料コンテンツの視聴",
      "SD画質（480p）",
      "広告あり",
      "1デバイスで視聴",
    ],
    notIncluded: ["General・VIPコンテンツ", "HD画質", "広告なし視聴"],
    buttonText: "無料プラン",
    buttonStyle: "bg-zinc-700 text-zinc-400 cursor-not-allowed",
    cardStyle: "border-zinc-700 bg-zinc-900/50",
    popular: false,
  },
  {
    id: "general",
    name: "Generalプラン",
    tier: "GENERAL" as Tier,
    price: 980,
    priceLabel: "¥980",
    period: "/月",
    description: "より多くのコンテンツをHD画質で楽しむ",
    icon: Star,
    features: [
      "無料+Generalコンテンツ",
      "HD画質（1080p）",
      "広告なし",
      "2デバイスで同時視聴",
      "ダウンロード機能",
    ],
    notIncluded: ["VIP限定コンテンツ"],
    buttonText: "Generalに登録",
    buttonStyle: "bg-blue-600 hover:bg-blue-700 text-white",
    cardStyle: "border-blue-600 bg-blue-950/30",
    popular: true,
    priceId: process.env.STRIPE_PRICE_GENERAL,
  },
  {
    id: "vip",
    name: "VIPプラン",
    tier: "VIP" as Tier,
    price: 1980,
    priceLabel: "¥1,980",
    period: "/月",
    description: "すべてのコンテンツを最高品質で",
    icon: Crown,
    features: [
      "すべてのコンテンツが見放題",
      "4K画質",
      "広告なし",
      "4デバイスで同時視聴",
      "ダウンロード機能",
      "先行配信作品",
      "限定コンテンツ",
    ],
    notIncluded: [],
    buttonText: "VIPに登録",
    buttonStyle:
      "bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-bold",
    cardStyle: "border-amber-500 bg-amber-950/20",
    popular: false,
    priceId: process.env.STRIPE_PRICE_VIP,
  },
];

const errorMessages: Record<string, string> = {
  invalid_request: "リクエストが無効です。もう一度お試しください。",
  stripe_not_configured:
    "決済システムが設定されていません。管理者にお問い合わせください。",
  stripe_error: "決済処理中にエラーが発生しました。もう一度お試しください。",
  no_checkout_url: "決済ページの生成に失敗しました。もう一度お試しください。",
  checkout_failed: "決済処理に失敗しました。もう一度お試しください。",
};

export default async function PricingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentTier: Tier | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    const tier = profile?.subscription_tier;
    if (tier === "NORMAL" || tier === "GENERAL" || tier === "VIP") {
      currentTier = tier;
    }
  }

  const showSuccess = params.success === "true";
  const showCanceled = params.canceled === "true";
  const errorCode = params.error;
  const errorMessage = errorCode
    ? errorMessages[errorCode] || "エラーが発生しました。"
    : null;

  return (
    <main className="min-h-screen bg-black pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 成功メッセージ */}
        {showSuccess && (
          <div className="mb-8 p-4 rounded-xl bg-green-900/30 border border-green-600 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center shrink-0">
              <PartyPopper className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-green-400">
                登録が完了しました！
              </h2>
              <p className="text-green-300/80 text-sm">
                ご登録ありがとうございます。すべてのコンテンツをお楽しみください。
              </p>
            </div>
            <Link
              href="/"
              className="w-full sm:w-auto sm:ml-auto bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-center"
            >
              ホームへ
            </Link>
          </div>
        )}

        {/* キャンセルメッセージ */}
        {showCanceled && (
          <div className="mb-8 p-4 rounded-xl bg-zinc-800 border border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
              <X className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white">
                決済がキャンセルされました
              </h2>
              <p className="text-zinc-400 text-sm">
                決済はキャンセルされました。いつでも再度お申し込みいただけます。
              </p>
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="mb-8 p-4 rounded-xl bg-red-900/30 border border-red-600 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-red-400">
                エラーが発生しました
              </h2>
              <p className="text-red-300/80 text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            料金プラン
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            あなたに最適なプランをお選びください。
            いつでもアップグレード・ダウングレードが可能です。
          </p>
          {currentTier && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 text-white text-sm">
              <Check className="w-4 h-4 text-green-500" />
              現在のプラン: <span className="font-bold">{currentTier}</span>
            </div>
          )}
        </div>

        {/* プランカード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const isCurrentPlan = currentTier === plan.tier;
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 lg:p-8 transition-all duration-300 hover:scale-[1.02] ${plan.cardStyle}`}
              >
                {/* 人気バッジ */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                      人気No.1
                    </span>
                  </div>
                )}

                {/* アイコン */}
                <div className="mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      plan.tier === "NORMAL"
                        ? "bg-zinc-800"
                        : plan.tier === "GENERAL"
                          ? "bg-blue-600"
                          : "bg-gradient-to-br from-amber-500 to-yellow-400"
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${plan.tier === "VIP" ? "text-black" : "text-white"}`}
                    />
                  </div>
                </div>

                {/* プラン名と価格 */}
                <h2 className="text-xl font-bold text-white mb-1">
                  {plan.name}
                </h2>
                <p className="text-zinc-400 text-sm mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-black text-white">
                    {plan.priceLabel}
                  </span>
                  <span className="text-zinc-400">{plan.period}</span>
                </div>

                {/* CTA ボタン */}
                {isCurrentPlan ? (
                  <div className="w-full py-3 px-4 rounded-lg bg-green-600/20 border border-green-600 text-green-500 text-center font-semibold mb-6">
                    <Check className="w-5 h-5 inline mr-2" />
                    現在のプラン
                  </div>
                ) : plan.tier === "NORMAL" ? (
                  <div className="w-full py-3 px-4 rounded-lg bg-zinc-800 text-zinc-500 text-center font-semibold mb-6">
                    基本プラン
                  </div>
                ) : !user ? (
                  <Link
                    href="/login?redirect=/pricing"
                    className={`block w-full py-3 px-4 rounded-lg text-center font-semibold mb-6 transition-colors ${plan.buttonStyle}`}
                  >
                    ログインして登録
                  </Link>
                ) : (
                  <form action="/api/billing/stripe/checkout" method="POST">
                    <input
                      type="hidden"
                      name="priceId"
                      value={plan.priceId || ""}
                    />
                    <input type="hidden" name="tier" value={plan.tier} />
                    <button
                      type="submit"
                      className={`w-full py-3 px-4 rounded-lg font-semibold mb-6 transition-colors ${plan.buttonStyle}`}
                    >
                      {plan.buttonText}
                    </button>
                  </form>
                )}

                {/* 機能リスト */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    含まれる機能
                  </p>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-zinc-300 text-sm">{feature}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 opacity-50"
                    >
                      <span className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5 text-center">
                        −
                      </span>
                      <span className="text-zinc-500 text-sm line-through">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">よくある質問</h2>
          <div className="max-w-2xl mx-auto space-y-4 text-left">
            <details className="group bg-zinc-900 rounded-lg p-4">
              <summary className="text-white font-semibold cursor-pointer list-none flex justify-between items-center">
                いつでも解約できますか？
                <span className="text-zinc-500 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-zinc-400 mt-3 text-sm">
                はい、いつでも解約可能です。解約後も請求期間の終了まではサービスをご利用いただけます。
              </p>
            </details>
            <details className="group bg-zinc-900 rounded-lg p-4">
              <summary className="text-white font-semibold cursor-pointer list-none flex justify-between items-center">
                支払い方法は何がありますか？
                <span className="text-zinc-500 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-zinc-400 mt-3 text-sm">
                クレジットカード（Visa、Mastercard、American
                Express、JCB）に対応しています。
              </p>
            </details>
            <details className="group bg-zinc-900 rounded-lg p-4">
              <summary className="text-white font-semibold cursor-pointer list-none flex justify-between items-center">
                プランの変更はできますか？
                <span className="text-zinc-500 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-zinc-400 mt-3 text-sm">
                はい、いつでもアップグレード・ダウングレードが可能です。料金は日割り計算されます。
              </p>
            </details>
          </div>
        </div>

        {/* フッターリンク */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
