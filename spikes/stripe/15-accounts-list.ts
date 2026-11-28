// 確かめること(ADR-0013、OPS-041):
// 連結アカウントの一覧を、Accounts v2 の一覧の API で読むときの、ページ送りの形と、一覧の結果に含まれる項目。
// 1ページを2件にして、1ページ目の中身と next_page_url を表示する。そのあと、SDK の自動のページ送りで、全件を数える。
// 一覧の API には include の指定がないため、カード決済などの状態(configuration)と、足りない項目(requirements)が、
// 一覧の結果に含まれるかも表示する。
// 閉じた連結アカウントは、closed を指定しない限り、一覧に含まれない(SDK の型の説明)。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env 15-accounts-list.ts

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}

const stripe = new Stripe(key);
const params: Stripe.V2.Core.AccountListParams = { limit: 2, applied_configurations: ["merchant"] };

function presence(value: unknown) {
  return value === undefined ? "含まれない" : value === null ? "null" : "含まれる";
}

try {
  console.log("API の版:", Stripe.API_VERSION);
  const first = await stripe.v2.core.accounts.list(params);
  console.log("1ページ目の件数:", first.data.length);
  for (const a of first.data) {
    console.log(`  ${a.id} / ${a.display_name} / 作成 ${a.created} / dashboard ${a.dashboard} / applied_configurations ${JSON.stringify(a.applied_configurations)} / metadata.purpose ${a.metadata?.purpose}`);
    console.log(`    configuration ${presence(a.configuration)} / requirements ${presence(a.requirements)}`);
  }
  console.log("next_page_url:", first.next_page_url);
  console.log("previous_page_url:", first.previous_page_url);

  let count = 0;
  for await (const a of stripe.v2.core.accounts.list(params)) {
    count++;
    console.log(`  ${count}. ${a.id} / ${a.metadata?.purpose}`);
  }
  console.log("全件(自動のページ送り):", count);
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("読めませんでした:", e.type, e.code, e.message);
  process.exit(1);
}
