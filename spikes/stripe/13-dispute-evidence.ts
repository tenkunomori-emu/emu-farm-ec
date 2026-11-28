// 確かめること(IF-038):
// 埋め込みコンポーネントで途中まで入力した反証資料が、あとから API で提出したときに、一緒に提出されるか。
//
// 手順:
//   1. create: 支払いを作って不審請求を1件起こし、サイトと同じく、提出方法を manual にする(submit: false)。
//   2. 埋め込みコンポーネント(embedded/dispute-evidence-server.ts)で、反証資料を途中まで入力し、提出せずに閉じる。
//   3. submit: 次の3つの時点で、空でない反証資料の項目を表示する。
//      a. 埋め込みコンポーネントで入力したあと(Stripe に残っている内容)
//      b. API の項目を、提出せずに足したあと(残っている内容と合わさるか)
//      c. API で送らない項目を空にして、提出したあと
//   show: 不審請求と、空でない反証資料の項目を表示する。
// API で送る uncategorized_text の winning_evidence は、サンドボックスで不審請求を勝ちにするテスト用の値である。
// 連結アカウントにすでに不審請求があるときは、create は支払いを作らず、今の不審請求を表示する。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 13-dispute-evidence.ts create <連結アカウントの ID>
//   node --env-file=.env 13-dispute-evidence.ts show <連結アカウントの ID>
//   node --env-file=.env 13-dispute-evidence.ts submit <連結アカウントの ID> <不審請求の ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [mode = "", accountId = "", disputeId = ""] = process.argv.slice(2);

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!["create", "show", "submit"].includes(mode) || !accountId.startsWith("acct_") || (mode === "submit" && !disputeId.startsWith("du_"))) {
  console.error("引数に、create か show か submit と、連結アカウントの ID(acct_ で始まるもの)を指定してください。submit では、続けて不審請求の ID(du_ で始まるもの)を指定してください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

// API で提出する反証資料。埋め込みコンポーネントで入力する内容と区別できる値にする。
const apiEvidence = {
  product_description: "API で送った商品の説明(方式検証)",
  uncategorized_text: "winning_evidence",
};

function filledFields(evidence: Stripe.Dispute.Evidence) {
  return Object.entries(evidence).filter(([, value]) => {
    if (value === null || value === "") return false;
    if (typeof value === "object") return JSON.stringify(value) !== "{}";
    return true;
  });
}

function printDispute(label: string, d: Stripe.Dispute) {
  const paymentIntent = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
  console.log(`${label}: ${d.id} / 支払い ${paymentIntent} / 状態 ${d.status} / intended_submission_method ${d.intended_submission_method} / submission_method ${d.evidence_details.submission_method} / 提出の回数 ${d.evidence_details.submission_count}`);
  const fields = filledFields(d.evidence);
  if (fields.length === 0) {
    console.log("  空でない反証資料の項目: なし");
  }
  for (const [name, value] of fields) {
    console.log(`  ${name}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
}

async function create() {
  const existing = await stripe.disputes.list({ limit: 10 }, onAccount);
  if (existing.data.length > 0) {
    console.log("この連結アカウントには、すでに不審請求があるため、支払いは作りません。今の不審請求を表示します。");
    for (const d of existing.data) printDispute("不審請求", d);
    return;
  }
  const intent = await stripe.paymentIntents.create(
    {
      amount: 3000,
      currency: "jpy",
      capture_method: "manual",
      application_fee_amount: 450,
      payment_method: "pm_card_createDispute",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { purpose: "spike-13-dispute-evidence" },
    },
    onAccount,
  );
  const captured = await stripe.paymentIntents.capture(intent.id, {}, onAccount);
  console.log(`支払い: ${captured.id} / 状態 ${captured.status}`);
  // 不審請求が起きるまで、5秒ごとに最大30秒待つ。
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const disputes = await stripe.disputes.list({ payment_intent: captured.id }, onAccount);
    const dispute = disputes.data[0];
    if (dispute) {
      // サイトと同じく、不審請求が起きたら提出方法を manual にする。submit: false を付けないと、反証資料が提出される。
      const updated = await stripe.disputes.update(dispute.id, { intended_submission_method: "manual", submit: false }, onAccount);
      printDispute("不審請求", updated);
      return;
    }
  }
  console.log("30秒待っても、不審請求が起きていません。少し待ってから、create をもう一度実行してください(支払いは増えません)。");
}

async function show() {
  const disputes = await stripe.disputes.list({ limit: 10 }, onAccount);
  if (disputes.data.length === 0) {
    console.log("不審請求はありません。");
  }
  for (const d of disputes.data) printDispute("不審請求", d);
}

async function submit() {
  const before = await stripe.disputes.retrieve(disputeId, {}, onAccount);
  printDispute("a. 埋め込みコンポーネントで入力したあと", before);

  const staged = await stripe.disputes.update(disputeId, { evidence: apiEvidence, submit: false }, onAccount);
  printDispute("b. API の項目を、提出せずに足したあと", staged);

  // API で送らない項目のうち、文字の値が入っているものを空にする。
  const cleared: Record<string, string> = {};
  for (const [name, value] of filledFields(staged.evidence)) {
    if (typeof value === "string" && !(name in apiEvidence)) cleared[name] = "";
  }
  console.log("空にする項目:", Object.keys(cleared).join(", ") || "なし");
  const submitted = await stripe.disputes.update(disputeId, { evidence: { ...cleared, ...apiEvidence }, submit: true }, onAccount);
  printDispute("c. API で送らない項目を空にして、提出したあと", submitted);
}

try {
  console.log("API の版:", Stripe.API_VERSION);
  if (mode === "create") await create();
  if (mode === "show") await show();
  if (mode === "submit") await submit();
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まりました:", e.type, e.code, e.message);
  process.exit(1);
}
