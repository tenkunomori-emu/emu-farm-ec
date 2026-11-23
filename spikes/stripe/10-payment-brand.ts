// 確かめること:
// 仮押さえに成功した支払い(PaymentIntent)から、サーバーが、カードのブランドを読めるか(FR-225、ADR-0008)。
// カードを手で入れた支払いと、Link の登録の枠に入力して払った支払いの両方で読む。
// 読めれば、画面で止める指定をすり抜けた JCB、ダイナースクラブ、ディスカバーの仮押さえを、
// 注文にせずに取り消せる。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 10-payment-brand.ts <生産者のアカウントの ID> <PaymentIntent の ID> [<PaymentIntent の ID> ...]

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [accountId = "", ...intentIds] = process.argv.slice(2);

if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスの鍵(sk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || intentIds.length === 0 || intentIds.some((id) => !id.startsWith("pi_"))) {
  console.error("引数に、生産者のアカウントの ID(acct_)と、PaymentIntent の ID(pi_)を1つ以上付けてください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const onAccount = { stripeAccount: accountId };

console.log("API の版:", Stripe.API_VERSION);
for (const id of intentIds) {
  try {
    const intent = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge", "payment_method"] }, onAccount);
    const charge = intent.latest_charge as Stripe.Charge | null;
    const method = intent.payment_method as Stripe.PaymentMethod | null;
    const details = charge?.payment_method_details;
    console.log(`${id}: status=${intent.status}`);
    console.log(`  支払い方法(PaymentMethod): type=${method?.type} card.brand=${method?.card?.brand} card.wallet=${method?.card?.wallet?.type}`);
    console.log(
      `  チャージの支払い方法の詳細: type=${details?.type} card.brand=${details?.card?.brand} card.network=${details?.card?.network} card.wallet=${details?.card?.wallet?.type}`,
    );
  } catch (err) {
    const e = err as { type?: string; code?: string; message?: string };
    console.log(`${id}: 読めなかった:`, e.type, e.code, e.message);
  }
}
