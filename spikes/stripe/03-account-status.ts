// 確かめること:
// 生産者のアカウントの今の状態(カード決済と入金が使えるか、足りない項目)。
// 入力画面での入力を終えたあとに動かし、支払いの受け付けが有効になったかを見る。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 03-account-status.ts <生産者のアカウントの ID>

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
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "defaults", "requirements"],
  });
  const capabilities = account.configuration?.merchant?.capabilities;
  console.log("API の版:", Stripe.API_VERSION);
  console.log("アカウントの ID:", account.id);
  console.log("ダッシュボード:", account.dashboard);
  console.log("責任の分担:", JSON.stringify(account.defaults?.responsibilities));
  console.log("カード決済:", JSON.stringify(capabilities?.card_payments));
  console.log("入金:", JSON.stringify(capabilities?.stripe_balance?.payouts));
  const entries = account.requirements?.entries ?? [];
  console.log("足りない項目の数:", entries.length);
  for (const entry of entries) {
    console.log("-", entry.description, "/", entry.awaiting_action_from, "/", entry.minimum_deadline?.status);
  }
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("読めなかった:", e.type, e.code, e.message);
  process.exit(1);
}
