// 確かめること:
// 不審請求の部品から証拠を出したあとの、不審請求と照会の状態と、生産者の残高。
// 勝ち(won)、負け(lost)、照会が閉じた(warning_closed)などに変わったかを見る。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 06-dispute-status.ts <生産者のアカウントの ID> <PaymentIntent の ID> [<PaymentIntent の ID> ...]

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [accountId = "", ...payments] = process.argv.slice(2);

if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスの鍵(sk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || payments.length === 0 || !payments.every((p) => p.startsWith("pi_"))) {
  console.error("引数に、生産者のアカウントの ID(acct_)と、PaymentIntent の ID(pi_)を1つ以上付けてください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

try {
  console.log("API の版:", Stripe.API_VERSION);
  for (const payment of payments) {
    const disputes = await stripe.disputes.list({ payment_intent: payment }, onAccount);
    if (disputes.data.length === 0) {
      console.log(`${payment}: 不審請求も照会もない`);
    }
    for (const d of disputes.data) {
      console.log(`${payment}: ${d.id} / 状態 ${d.status} / 額 ${d.amount} / 証拠を出したか ${d.evidence_details?.submission_count ?? 0} 回 / 返金できるか ${d.is_charge_refundable}`);
    }
  }
  const balance = await stripe.balance.retrieve({}, onAccount);
  const jpy = (list: Stripe.Balance.Available[]) =>
    list.filter((b) => b.currency === "jpy").map((b) => b.amount).join(",") || "0";
  console.log(`残高(円): すぐに使える額 ${jpy(balance.available)} / 保留中 ${jpy(balance.pending)}`);
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("読めなかった:", e.type, e.code, e.message);
  process.exit(1);
}
