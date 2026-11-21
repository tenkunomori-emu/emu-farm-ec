// 確かめること:
// 生産者のアカウントの上の支払い(仮押さえして代金を確定したもの)に、
// 不審請求と照会(不審請求の前の問い合わせ)が起きたときの、Stripe の記録の形。
// 状態、理由、額、証拠を出す期限、生産者の残高を表示する。
//
// 手順: Stripe のテスト用のカードで、3,000 円の支払いを2件作る
// (アプリケーション手数料 450 円)。1件目は不審請求(pm_card_createDispute)、
// 2件目は照会(pm_card_createDisputeInquiry)が、代金の確定のあとに起きる。
// 表示した PaymentIntent の ID は、不審請求の部品の確かめで使う。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 05-dispute.ts <生産者のアカウントの ID>

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

async function payAndCapture(paymentMethod: string, label: string) {
  const intent = await stripe.paymentIntents.create(
    {
      amount: 3000,
      currency: "jpy",
      capture_method: "manual",
      application_fee_amount: 450,
      payment_method: paymentMethod,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { purpose: `spike-05-${label}` },
    },
    onAccount,
  );
  const captured = await stripe.paymentIntents.capture(intent.id, {}, onAccount);
  console.log(`${label}: PaymentIntent ${captured.id} / ${captured.status}`);
  return captured.id;
}

async function showDisputes(paymentIntentId: string, label: string) {
  const disputes = await stripe.disputes.list({ payment_intent: paymentIntentId }, onAccount);
  if (disputes.data.length === 0) {
    console.log(`${label}: まだ不審請求も照会もない`);
    return;
  }
  for (const d of disputes.data) {
    const dueBy = d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString() : "なし";
    console.log(`${label}: ${d.id} / 状態 ${d.status} / 理由 ${d.reason} / 額 ${d.amount} / 証拠の期限 ${dueBy} / 返金できるか ${d.is_charge_refundable}`);
  }
}

try {
  console.log("API の版:", Stripe.API_VERSION);
  await showBalance("1. 支払いの前");

  const disputed = await payAndCapture("pm_card_createDispute", "2. 不審請求のカード");
  const inquired = await payAndCapture("pm_card_createDisputeInquiry", "3. 照会のカード");

  await new Promise((resolve) => setTimeout(resolve, 10000));
  await showDisputes(disputed, "4. 10秒後の不審請求");
  await showDisputes(inquired, "5. 10秒後の照会");
  await showBalance("6. 10秒後");
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まった:", e.type, e.code, e.message);
  process.exit(1);
}
