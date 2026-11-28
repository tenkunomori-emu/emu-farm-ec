// 確かめること(Issue #221 の後片付け。Issue #222 で1つ目の確かめ用の連結アカウントを閉じるときにも使う):
// 確かめ用の連結アカウントを、Accounts v2 の「Close an account」で閉じられるか。残高があっても閉じられるか。
// 閉じると元に戻せない(公式ページ「Connect and the Accounts v2 API」)。登録済みの検証の連結アカウント(TST-024)は閉じない。
//   show: アカウントの作成日時、表示名、設定(applied_configurations)、閉じたか(closed)と、残高を表示する。
//   close: show と同じ内容を表示してから、設定をすべて指定して閉じる(公式ページの決まり)。閉じたあとの closed を表示する。
//
// 動かし方(spikes/stripe のフォルダーで):
//   1. 閉じるアカウントで合っているかを、作成日時と表示名で確かめる。
//        node --env-file=.env 17-close-account.ts show <連結アカウントの ID>
//   2. 閉じる。
//        node --env-file=.env 17-close-account.ts close <連結アカウントの ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [mode = "", accountId = ""] = process.argv.slice(2);

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!["show", "close"].includes(mode) || !accountId.startsWith("acct_")) {
  console.error("引数に、show か close と、連結アカウントの ID(acct_ で始まるもの)を指定してください。");
  process.exit(1);
}

const stripe = new Stripe(key);

try {
  console.log("API の版:", Stripe.API_VERSION);
  const account = await stripe.v2.core.accounts.retrieve(accountId);
  console.log("作成日時:", account.created);
  console.log("表示名:", account.display_name);
  console.log("設定:", account.applied_configurations.join(","));
  console.log("閉じたか:", account.closed);
  const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId });
  console.log("残高(利用可能):", balance.available.map((b) => `${b.amount} ${b.currency}`).join(", "));
  console.log("残高(保留中):", balance.pending.map((b) => `${b.amount} ${b.currency}`).join(", "));
  if (mode === "close") {
    const closed = await stripe.v2.core.accounts.close(accountId, { applied_configurations: account.applied_configurations });
    console.log("閉じた結果: closed =", closed.closed);
  }
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("途中で止まりました:", e.type, e.code, e.message);
  process.exit(1);
}
