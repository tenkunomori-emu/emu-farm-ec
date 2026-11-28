// 確かめること:
// 連結アカウントの状態が変わったときに、Stripe が記録したイベント。
// v2 のイベント(Events v2 API)と、v1 の account.updated(Events v1 API)を、時刻の順に表示する(IF-053)。
// イベントの ID を付けると、そのイベントの全体を表示する。v2 のイベントの全体には、変更前と変更後の値(changes)が含まれる。
// Events API で取得できるのは、作成から30日以内のイベントだけである。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 11-account-events.ts <連結アカウントの ID>
//   node --env-file=.env 11-account-events.ts <連結アカウントの ID> <v1 か v2> <イベントの ID>

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const [accountId = "", version, eventId = ""] = process.argv.slice(2);

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || (version !== undefined && !((version === "v1" || version === "v2") && eventId.startsWith("evt_")))) {
  console.error("引数に、連結アカウントの ID(acct_ で始まるもの)を指定してください。イベントの全体を表示するときは、続けて v1 か v2 と、イベントの ID(evt_ で始まるもの)を指定してください。");
  process.exit(1);
}

const stripe = new Stripe(key);
// v1 の account.updated は、連結アカウントで記録されるため、Stripe-Account ヘッダーを付けて取得する。
const onAccount = { stripeAccount: accountId };

function printError(label: string, err: unknown) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error(`${label}の取得に失敗しました:`, e.type, e.code, e.message);
}

console.log("API の版:", Stripe.API_VERSION);

if (version !== undefined) {
  try {
    const event = version === "v2" ? await stripe.v2.core.events.retrieve(eventId) : await stripe.events.retrieve(eventId, {}, onAccount);
    console.log(JSON.stringify(event, null, 2));
  } catch (err) {
    printError("イベント", err);
    process.exit(1);
  }
} else {
  const lines: { at: string; text: string }[] = [];
  let failed = false;

  // v2 のイベント。Accounts v2 のアカウントはプラットフォームのオブジェクトなので、Stripe-Account ヘッダーを付けず、object_id で絞り込む。
  // data は、一覧の結果に含まれるとは限らないため、イベントを1件ずつ取得して読む。
  try {
    let count = 0;
    for await (const listed of stripe.v2.core.events.list({ object_id: accountId })) {
      const event = await stripe.v2.core.events.retrieve(listed.id);
      const data = "data" in event ? JSON.stringify(event.data) : "";
      lines.push({ at: event.created, text: `v2 ${event.type} ${event.id} ${data}` });
      count++;
    }
    console.log("v2 のイベントの数:", count);
  } catch (err) {
    printError("v2 のイベント", err);
    failed = true;
  }

  // v1 の account.updated。
  try {
    let count = 0;
    for await (const event of stripe.events.list({ type: "account.updated" }, onAccount)) {
      const account = event.data.object as Stripe.Account;
      const changed = Object.keys(event.data.previous_attributes ?? {}).join(",");
      const at = new Date(event.created * 1000).toISOString();
      lines.push({
        at,
        text: `v1 ${event.type} ${event.id} charges_enabled=${account.charges_enabled} payouts_enabled=${account.payouts_enabled} card_payments=${account.capabilities?.card_payments} 変更された項目=${changed}`,
      });
      count++;
    }
    console.log("v1 のイベントの数:", count);
  } catch (err) {
    printError("v1 のイベント", err);
    failed = true;
  }

  lines.sort((a, b) => a.at.localeCompare(b.at));
  for (const line of lines) {
    console.log(line.at, line.text);
  }
  if (failed) {
    process.exit(1);
  }
}
