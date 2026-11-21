// 確かめること:
// Stripe が購入者に出す領収書に、税率ごとの消費税を示せるか(FR-067、FR-068)。
// 軽減税率(8%)の商品 1,080 円と、標準税率(10%)の送料 1,100 円の注文で、
// 税込みの税率(Tax Rate、inclusive)を行ごとに付けた購入手続きの画面を作る。
// 支払ったあと、代金を確定し、Stripe の領収書のページの URL を表示する。
//
// 動かし方(spikes/stripe のフォルダーで):
//   1. 購入手続きの画面を作る:
//      node --env-file=.env 08-receipt-tax.ts create <生産者のアカウントの ID>
//   2. 表示された URL をブラウザーで開き、テスト用のカードで支払う。
//   3. 代金を確定し、領収書の URL と税の内訳を表示する:
//      node --env-file=.env 08-receipt-tax.ts receipt <生産者のアカウントの ID> <購入手続きの画面の ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [mode = "", accountId = "", sessionId = ""] = process.argv.slice(2);

if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスの鍵(sk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || (mode !== "create" && mode !== "receipt") || (mode === "receipt" && !sessionId.startsWith("cs_"))) {
  console.error("引数は「create <acct_...>」か「receipt <acct_...> <cs_...>」にしてください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

try {
  console.log("API の版:", Stripe.API_VERSION);

  if (mode === "create") {
    const reduced = await stripe.taxRates.create(
      { display_name: "消費税(軽減税率)", percentage: 8, inclusive: true, country: "JP", tax_type: "jct" },
      onAccount,
    );
    const standard = await stripe.taxRates.create(
      { display_name: "消費税", percentage: 10, inclusive: true, country: "JP", tax_type: "jct" },
      onAccount,
    );
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: { currency: "jpy", unit_amount: 1080, product_data: { name: "方式検証の商品(食品・軽減税率)" } },
            tax_rates: [reduced.id],
          },
          {
            quantity: 1,
            price_data: { currency: "jpy", unit_amount: 1100, product_data: { name: "送料" } },
            tax_rates: [standard.id],
          },
        ],
        payment_intent_data: {
          capture_method: "manual",
          application_fee_amount: 162,
          metadata: { purpose: "spike-08-receipt-tax" },
        },
        payment_method_options: {
          card: { restrictions: { brands_blocked: ["discover_global_network"] } },
        },
        success_url: "http://localhost:4242/?checkout=success",
        cancel_url: "http://localhost:4242/?checkout=cancel",
      },
      onAccount,
    );
    console.log("税率:", reduced.id, "(8%)", standard.id, "(10%)");
    console.log("購入手続きの画面の ID:", session.id);
    console.log("購入手続きの画面(ブラウザーで開く):");
    console.log(session.url);
  } else {
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { expand: ["total_details.breakdown"] },
      onAccount,
    );
    console.log("合計:", session.amount_total, "/ 税:", session.total_details?.amount_tax);
    for (const tax of session.total_details?.breakdown?.taxes ?? []) {
      console.log(`税の内訳: ${tax.rate.display_name} ${tax.rate.percentage}% / 対象の額 ${tax.taxable_amount} / 税額 ${tax.amount}`);
    }
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intentId) {
      console.error("まだ支払われていない(PaymentIntent がない)。");
      process.exit(1);
    }
    const intent = await stripe.paymentIntents.retrieve(intentId, {}, onAccount);
    if (intent.status === "requires_capture") {
      await stripe.paymentIntents.capture(intentId, {}, onAccount);
      console.log("代金を確定した:", intentId);
    }
    const captured = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] }, onAccount);
    const charge = captured.latest_charge as Stripe.Charge | null;
    console.log("支払いの状態:", captured.status);
    console.log("Stripe の領収書のページ(ブラウザーで開く):");
    console.log(charge?.receipt_url ?? "なし");
  }
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まった:", e.type, e.code, e.message);
  process.exit(1);
}
