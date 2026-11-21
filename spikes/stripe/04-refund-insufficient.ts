// 確かめること:
// 生産者の Stripe の残高(すぐに使える額)が足りないときに、全額を返金すると、
// 返金が「結果待ち」(pending)になるか、残高がマイナスになって返金が通るか。
// ADR-0005 は「マイナスになる」、公式ページ「Refund and cancel payments」は
// 「すぐに使える残高で足りないカードの返金は、足りるまで結果待ちになる」としている。
//
// 手順: 生産者のアカウントの上に、テスト用のカードで 3,000 円の支払いを作って仮押さえし、
// 代金を確定する(アプリケーション手数料 450 円)。確定した代金は、すぐには使える残高に
// 入らない。そのまま全額を返金し、返金の状態と残高を表示する。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 04-refund-insufficient.ts <生産者のアカウントの ID>

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
const onAccount = { stripeAccount: accountId };

async function showBalance(label: string) {
  const balance = await stripe.balance.retrieve({}, onAccount);
  const jpy = (list: Stripe.Balance.Available[]) =>
    list.filter((b) => b.currency === "jpy").map((b) => b.amount).join(",") || "0";
  console.log(`${label} 残高(円): すぐに使える額 ${jpy(balance.available)} / 保留中 ${jpy(balance.pending)}`);
}

try {
  console.log("API の版:", Stripe.API_VERSION);
  await showBalance("1. 支払いの前");

  const intent = await stripe.paymentIntents.create(
    {
      amount: 3000,
      currency: "jpy",
      capture_method: "manual",
      application_fee_amount: 450,
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { purpose: "spike-04-refund-insufficient" },
    },
    onAccount,
  );
  console.log("2. 仮押さえ:", intent.id, intent.status);

  const captured = await stripe.paymentIntents.capture(intent.id, {}, onAccount);
  console.log("3. 代金の確定:", captured.status);
  await showBalance("4. 確定のあと");

  const refund = await stripe.refunds.create({ payment_intent: intent.id }, onAccount);
  console.log("5. 返金:", refund.id, "状態", refund.status, "/ 結果待ちの理由", refund.pending_reason ?? "なし");
  await showBalance("6. 返金のあと");

  await new Promise((resolve) => setTimeout(resolve, 5000));
  const again = await stripe.refunds.retrieve(refund.id, {}, onAccount);
  console.log("7. 5秒後の返金:", "状態", again.status, "/ 結果待ちの理由", again.pending_reason ?? "なし", "/ 失敗の理由", again.failure_reason ?? "なし");
  await showBalance("8. 5秒後");
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まった:", e.type, e.code, e.message);
  process.exit(1);
}
