// 確かめること(ADR-0009、IF-053):
// カード決済が有効になった連結アカウントで、公式ページ「Testing Stripe Connect」のテスト用の値を使い、
// カード決済(支払いの受け付け)を無効にできるか。ほかの確かめが終わってから、最後に行う。
// 使うのは、ウェブサイトの URL の https://inactivity.stripe.com である。公式ページでは、アカウントを inactive にし、
// active でないケイパビリティの無効の理由を paused.inactivity にする値である。
// ウェブサイトは、連結アカウントの人が、アカウントの管理の部品(embedded/server.ts)で変える。
// 情報を直す画面のリンク(Account Link の account_update)は使えない。公式ページ「Onboard your connected account」では、
// account_update のリンクは、情報の収集を管理者が受け持つアカウントにしか作れない。ダッシュボードがなく、
// マイナス残高の責任が Stripe のアカウントでは、埋め込みの部品を使う必要がある。
// 受け付けを止めるカード(4000000000004210)は、連結アカウントに eventually_due の要件がないと働かない(公式ページ)。
// 登録を終えた確かめ用の連結アカウントには、足りない項目が残らない(このスクリプトで確かめる)ため、使わない。
// このスクリプトは、カード決済と入金の状態と、その理由(status_details)、ウェブサイト、足りない項目を表示する。
// 無効になったときのイベントは、11-account-events.ts で読む(IF-053)。
//
// 動かし方(spikes/stripe のフォルダーで):
//   1. 状態を表示し、カード決済が active で、足りない項目が0であることを確かめる。
//        node --env-file=.env 16-disable-account.ts <連結アカウントの ID>
//   2. 部品の画面を動かし、http://localhost:4242 の「アカウントの管理」で、ウェブサイトを https://inactivity.stripe.com に変える。
//      Stripe のログインで SMS のコードを求められたら、000-000 を入れる(公式ページ「Testing Stripe Connect」)。
//        node --env-file=.env embedded/server.ts <連結アカウントの ID>
//   3. 1 のコマンドで状態を表示し、ウェブサイトが変わり、カード決済が active でなくなったかを確かめる。

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

try {
  console.log("API の版:", Stripe.API_VERSION);
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "defaults", "requirements"],
  });
  const capabilities = account.configuration?.merchant?.capabilities;
  console.log("今の状態:", new Date().toISOString());
  console.log("  カード決済:", capabilities?.card_payments?.status, JSON.stringify(capabilities?.card_payments?.status_details));
  console.log("  入金:", capabilities?.stripe_balance?.payouts?.status, JSON.stringify(capabilities?.stripe_balance?.payouts?.status_details));
  console.log("  ウェブサイト:", account.defaults?.profile?.business_url);
  const entries = account.requirements?.entries ?? [];
  console.log("  足りない項目の数:", entries.length);
  for (const entry of entries) {
    console.log(`  - ${entry.description} / ${entry.awaiting_action_from} / ${entry.minimum_deadline.status} / ${entry.errors.map((e) => e.code).join(",")}`);
  }
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まりました:", e.type, e.code, e.message);
  process.exit(1);
}
