// 確かめること(OPS-026):
// 注文を作り直すとき(OPS-023、TRN-062)に、Stripe の Checkout Session と支払いから、次の値を読めるか。
// 商品の名前、数量、価格、商品の小計、送料、支払いの総額、消費税の税率、アプリケーション手数料の額、
// 決済手数料、購入者のメールアドレス、代金を確定した日時、購入手続きを見分ける ID と商品の ID(SYS-012)。
// 代金を確定した日時は、支払い(Charge)に項目がないため、キャプチャーで作られる残高の取引の作成日時を、
// キャプチャーを呼んだ日時と比べる。
//
// 手順:
//   1. embedded/order-recovery-server.ts で購入手続きを作り、テスト用のカードで支払う(オーソリだけ)。
//   2. このファイルで、支払いをキャプチャーしてから、値を読んで表示する。キャプチャー済みのときは、読むだけにする。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 14-order-recovery-values.ts <連結アカウントの ID> <Checkout Session の ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [accountId = "", sessionId = ""] = process.argv.slice(2);

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || !sessionId.startsWith("cs_")) {
  console.error("引数に、連結アカウントの ID(acct_ で始まるもの)と、Checkout Session の ID(cs_ で始まるもの)を指定してください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

function toTime(seconds: number) {
  const jst = new Date(seconds * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return `${new Date(seconds * 1000).toISOString()}(日本時間 ${jst})`;
}

function readSession() {
  return stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge.balance_transaction"] }, onAccount);
}

try {
  console.log("API の版:", Stripe.API_VERSION);
  let session = await readSession();
  let intent = session.payment_intent;
  if (intent === null || typeof intent === "string") {
    console.error("この購入手続きには、まだ支払いがありません。画面で支払ってから、もう一度実行してください。");
    process.exit(1);
  }
  if (intent.status === "requires_capture") {
    const calledAt = Math.floor(Date.now() / 1000);
    await stripe.paymentIntents.capture(intent.id, {}, onAccount);
    console.log("キャプチャーを呼んだ日時:", toTime(calledAt));
    session = await readSession();
    intent = session.payment_intent as Stripe.PaymentIntent;
  }
  const charge = intent.latest_charge as Stripe.Charge | null;
  const transaction = (charge?.balance_transaction ?? null) as Stripe.BalanceTransaction | null;
  const items = await stripe.checkout.sessions.listLineItems(sessionId, { expand: ["data.taxes"] }, onAccount);

  console.log(`状態: Checkout Session ${session.status} / ${session.payment_status} / 支払い ${intent.status} / キャプチャー済み ${charge?.captured}`);
  console.log(`購入手続きを見分ける ID: Checkout Session ${session.metadata?.purchase_id} / 支払い ${intent.metadata.purchase_id}`);
  console.log(`商品の ID: Checkout Session ${session.metadata?.product_id} / 支払い ${intent.metadata.product_id}`);
  for (const item of items.data) {
    const taxes =
      (item.taxes ?? [])
        .map((t) => `${t.rate.display_name} ${t.rate.percentage}%(inclusive ${t.rate.inclusive})の税額 ${t.amount} 円`)
        .join("、") || "なし";
    console.log(`明細: ${item.description} / 数量 ${item.quantity} / 価格 ${item.price?.unit_amount} 円 / amount_subtotal ${item.amount_subtotal} 円 / amount_tax ${item.amount_tax} 円 / amount_total ${item.amount_total} 円 / 税率 ${taxes}`);
  }
  console.log(`支払いの総額: Checkout Session ${session.amount_total} 円 / 支払い ${intent.amount} 円 / 受け取った額 ${intent.amount_received} 円`);
  console.log(`アプリケーション手数料の額: 支払い ${intent.application_fee_amount} 円 / Charge ${charge?.application_fee_amount} 円`);
  console.log(`残高の取引: 額 ${transaction?.amount} 円 / 手数料 ${transaction?.fee} 円 / 差し引き ${transaction?.net} 円`);
  for (const fee of transaction?.fee_details ?? []) {
    console.log(`  手数料の内訳: ${fee.type} ${fee.amount} 円(${fee.description})`);
  }
  console.log(`購入者のメールアドレス: customer_details ${session.customer_details?.email} / customer_email ${session.customer_email} / Charge の billing_details ${charge?.billing_details.email} / receipt_email ${intent.receipt_email}`);
  console.log(`代金を確定した日時の候補: 残高の取引の作成日時 ${transaction ? toTime(transaction.created) : "なし"}`);
  console.log(`(参考)Charge の作成日時(オーソリ): ${charge ? toTime(charge.created) : "なし"}`);
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まりました:", e.type, e.code, e.message);
  process.exit(1);
}
