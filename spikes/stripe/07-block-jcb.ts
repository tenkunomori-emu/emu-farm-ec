// 確かめること:
// JCB、ダイナースクラブ、ディスカバーのカードを、購入手続きで止められるか(FR-225)。
// Stripe の購入手続きの画面(Checkout)で、カードのブランドを止める項目
// (payment_method_options.card.restrictions.brands_blocked)に discover_global_network を指定する。
// 公式ページ「Customize card brands」では、この値は Discover Global Network の
// カード(Discover、Diners、JCB、UnionPay、Elo)をまとめて止める。
//
// 手順: 生産者のアカウントの上に、3,000 円の購入手続きの画面を作り(仮押さえ、
// アプリケーション手数料 450 円)、URL を表示する。ブラウザーで開き、JCB の
// テスト用のカードで払えないことと、Visa のテスト用のカードで払えることを確かめる。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 07-block-jcb.ts <生産者のアカウントの ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const accountId = process.argv[2] ?? "";

if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスの鍵(sk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_")) {
  console.error("生産者のアカウントの ID(acct_ で始まるもの)を、引数に付けてください。");
  process.exit(1);
}

const stripe = new Stripe(key);

try {
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "jpy", unit_amount: 3000, product_data: { name: "方式検証の商品" } },
        },
      ],
      payment_intent_data: {
        capture_method: "manual",
        application_fee_amount: 450,
        metadata: { purpose: "spike-07-block-jcb" },
      },
      payment_method_options: {
        card: { restrictions: { brands_blocked: ["discover_global_network"] } },
      },
      success_url: "http://localhost:4242/?checkout=success",
      cancel_url: "http://localhost:4242/?checkout=cancel",
    },
    { stripeAccount: accountId },
  );
  console.log("API の版:", Stripe.API_VERSION);
  console.log("購入手続きの画面の ID:", session.id);
  console.log("止めたブランド:", JSON.stringify(session.payment_method_options?.card?.restrictions));
  console.log("購入手続きの画面(ブラウザーで開く):");
  console.log(session.url);
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("作れなかった:", e.type, e.code, e.message);
  process.exit(1);
}
