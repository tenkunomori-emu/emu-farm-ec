// 確かめること(Issue #222 の準備):
// 連結アカウントに、利用可能な残高に直接入る支払いを1件作り、そのあと不審請求を2件起こす。
// 不審請求ごとに、反証資料の提出期限(evidence_details.due_by)、intended_submission_method、
// evidence_details.submission_method と、残高から引かれた額と手数料(balance_transactions)を表示する。
// 1件目は、何もしないまま提出期限を過ぎるのを待つ(IF-035)。
// 2件目は、提出期限の前に埋め込みコンポーネントを開いておき、期限のあとに提出を試す(IF-040)。
//
// 手順:
//   1. pm_card_bypassPending で、20,000 円の支払いを作る。利用可能な残高に直接入る。
//   2. pm_card_createDispute で、3,000 円の支払いを2件作る(オーソリしてからキャプチャーし、アプリケーション手数料は 450 円)。
//      キャプチャーのあとに、不審請求が起きる。
// 1 の額は、2件の不審請求で残高から引かれる額(額 3,000 円と手数料 1,650 円を2件。ADR-0009)より大きくする。
// 残高がマイナスの間は、入金が止まるためである(ADR-0005)。
// 連結アカウントにすでに不審請求があるときは、支払いを作らず、今の不審請求を表示する。
// 2回実行しても、支払いと不審請求が増えないようにするためである。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 12-funding-and-disputes.ts <連結アカウントの ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const accountId = process.argv[2] ?? "";

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_")) {
  console.error("引数に、連結アカウントの ID(acct_ で始まるもの)を指定してください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

function toJst(seconds: number) {
  return new Date(seconds * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

async function showBalance(label: string) {
  const balance = await stripe.balance.retrieve({}, onAccount);
  const jpy = (list: Stripe.Balance.Available[]) =>
    list.filter((b) => b.currency === "jpy").map((b) => b.amount).join(",") || "0";
  console.log(`${label}: 利用可能な残高 ${jpy(balance.available)} 円 / 保留中の残高 ${jpy(balance.pending)} 円`);
}

async function fund() {
  const intent = await stripe.paymentIntents.create(
    {
      amount: 20000,
      currency: "jpy",
      payment_method: "pm_card_bypassPending",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { purpose: "spike-12-funding" },
    },
    onAccount,
  );
  console.log(`残高に入れる支払い: ${intent.id} / 状態 ${intent.status} / 額 ${intent.amount} 円`);
}

async function payToDispute(label: string) {
  const intent = await stripe.paymentIntents.create(
    {
      amount: 3000,
      currency: "jpy",
      capture_method: "manual",
      application_fee_amount: 450,
      payment_method: "pm_card_createDispute",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { purpose: `spike-12-dispute-${label}` },
    },
    onAccount,
  );
  const captured = await stripe.paymentIntents.capture(intent.id, {}, onAccount);
  console.log(`不審請求 ${label} の支払い: ${captured.id} / 状態 ${captured.status}`);
}

// 不審請求を、起きた順に「不審請求 1」「不審請求 2」として表示する。
async function showDisputes() {
  const disputes = await stripe.disputes.list({ limit: 10 }, onAccount);
  const sorted = [...disputes.data].sort((a, b) => a.created - b.created);
  sorted.forEach((d, i) => {
    const dueBy = d.evidence_details?.due_by;
    const paymentIntent = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
    console.log(`不審請求 ${i + 1}: ${d.id} / 支払い ${paymentIntent} / 状態 ${d.status} / 理由 ${d.reason} / 額 ${d.amount} 円`);
    console.log(`  提出期限: ${dueBy ? `${new Date(dueBy * 1000).toISOString()}(日本時間 ${toJst(dueBy)})` : "なし"}`);
    console.log(`  intended_submission_method: ${d.intended_submission_method} / evidence_details.submission_method: ${d.evidence_details?.submission_method}`);
    for (const t of d.balance_transactions) {
      console.log(`  残高の取引: ${t.id} / 額 ${t.amount} 円 / 手数料 ${t.fee} 円 / 差し引き ${t.net} 円`);
    }
  });
  return sorted.length;
}

try {
  console.log("API の版:", Stripe.API_VERSION);
  const existing = await stripe.disputes.list({ limit: 1 }, onAccount);
  if (existing.data.length > 0) {
    console.log("この連結アカウントには、すでに不審請求があるため、支払いは作りません。今の不審請求を表示します。");
    await showDisputes();
    await showBalance("今");
  } else {
    await showBalance("1. 支払いの前");
    await fund();
    await showBalance("2. 残高に入れる支払いのあと");
    await payToDispute("1");
    await payToDispute("2");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const count = await showDisputes();
    if (count < 2) {
      console.log("不審請求が、まだ2件そろっていません。少し待ってから、もう一度実行してください(支払いは増えません)。");
    }
    await showBalance("3. 10秒後");
  }
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まりました:", e.type, e.code, e.message);
  process.exit(1);
}
