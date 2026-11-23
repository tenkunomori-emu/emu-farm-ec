// 確かめること:
// 購入手続き(Checkout Session)を、期限を待たずに終わらせたとき(expire)の動き。
// 購入手続きの期限(作ってから1時間)の処理が、Stripe の側でどう働くかを見る。
// - 何もしていない購入手続きを終わらせると、そのあと払えなくなるか。
// - カードが通らなかった購入手続きを終わらせると、その支払い(PaymentIntent)はどうなるか。
// - 本人認証の途中で終わらせ、そのあと認証を済ませると、仮押さえは成功するか。
// - 仮押さえに成功した(complete の)購入手続きを終わらせようとすると、Stripe は断るか。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 09-checkout-expire.ts <生産者のアカウントの ID> <購入手続きの ID>
// 購入手続きは、embedded/checkout-server.ts のページで作ったものを使う。

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [accountId = "", sessionId = ""] = process.argv.slice(2);

if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスの鍵(sk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || !sessionId.startsWith("cs_")) {
  console.error("引数は「<acct_...> <cs_...>」にしてください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

async function show(label: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {}, onAccount);
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  console.log(`${label}: 購入手続き status=${session.status} payment_status=${session.payment_status}`);
  if (!intentId) {
    console.log(`${label}: 支払い(PaymentIntent)は、まだない`);
    return;
  }
  const intent = await stripe.paymentIntents.retrieve(intentId, {}, onAccount);
  console.log(
    `${label}: 支払い ${intent.id} status=${intent.status} amount_capturable=${intent.amount_capturable} cancellation_reason=${intent.cancellation_reason}`,
  );
}

console.log("API の版:", Stripe.API_VERSION);
await show("終わらせる前");
try {
  const expired = await stripe.checkout.sessions.expire(sessionId, {}, onAccount);
  console.log("終わらせた: status=" + expired.status);
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.log("Stripe が断った:", e.type, e.code, e.message);
}
await show("終わらせたあと");
