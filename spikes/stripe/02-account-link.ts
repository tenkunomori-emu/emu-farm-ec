// 確かめること:
// 生産者の入力画面へのリンク(Account Link)を、Accounts v2 の正式な版の API で作れるか。
// ダッシュボードなし、マイナス残高の責任が Stripe のアカウントで、作れるか。
// 作れたときは、リンクと期限を表示する。リンクは1回だけ使え、期限は短い。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 02-account-link.ts <生産者のアカウントの ID>
// 入力を終えると http://localhost:4242/ に戻る。戻り先を開くため、
// 別のターミナルで embedded/server.ts を動かしておく。

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
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: "http://localhost:4242/",
        return_url: "http://localhost:4242/",
      },
    },
  });
  console.log("API の版:", Stripe.API_VERSION);
  console.log("作った日時:", link.created);
  console.log("期限:", link.expires_at);
  console.log("入力画面へのリンク(ブラウザーで開く):");
  console.log(link.url);
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("作れなかった:", e.type, e.code, e.message);
  process.exit(1);
}
