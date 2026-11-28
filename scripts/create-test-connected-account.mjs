// テスト用の連結アカウント(支払いを受け付けられる生産者のアカウント)を、
// Stripe のサンドボックスに登録する(基本設計書の TST-024)。
//
// 使い方(リポジトリの直下で):
//   1. 連結アカウントを作り、入力画面のリンクを表示する
//        node --env-file=.env.local scripts/create-test-connected-account.mjs
//   2. 連結アカウントの状態を表示する。入力が足りないときは、新しいリンクを表示する。
//      Stripe が確認しているとき(pending)は、待つように表示する
//        node --env-file=.env.local scripts/create-test-connected-account.mjs acct_...
//
// 連結アカウントは、ADR-0009 の「1. 生産者のアカウントの設定」の設定で作る。
// 入力画面のリンク(Account Link)は、このテスト用のアカウントだけに使う。
// サイトでの生産者の登録は、埋め込みコンポーネントで行う(ADR-0009)。
// リンクの期限は、作ってから5分である。期限が切れたときは、2 を実行する。

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const accountId = process.argv[2];

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error(
    "STRIPE_SECRET_KEY に、サンドボックスのシークレットキー(sk_test_ で始まるもの)か、制限付きのキー(rk_test_ で始まるもの)を入れてください。",
  );
  process.exit(1);
}
if (accountId !== undefined && !accountId.startsWith("acct_")) {
  console.error(
    "引数には、連結アカウントの ID(acct_ で始まるもの)を指定してください。",
  );
  process.exit(1);
}

const stripe = new Stripe(key);
// 入力を終えたとき、または期限が切れたときに開くページ。テスト用のため、内容のないページにする。
const RETURN_URL = "https://example.com/";

async function createAccount() {
  return stripe.v2.core.accounts.create({
    contact_email: "test-producer@example.com",
    display_name: "テスト用の生産者",
    dashboard: "none",
    identity: { country: "jp", entity_type: "individual" },
    configuration: {
      merchant: { capabilities: { card_payments: { requested: true } } },
    },
    defaults: {
      currency: "jpy",
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    metadata: { purpose: "test-connected-account" },
  });
}

async function printLink(id) {
  const link = await stripe.v2.core.accountLinks.create({
    account: id,
    use_case: {
      type: "account_onboarding",
      account_onboarding: { refresh_url: RETURN_URL, return_url: RETURN_URL },
    },
  });
  console.log("入力画面のリンク(5分以内にブラウザーで開く):");
  console.log(link.url);
}

try {
  if (accountId === undefined) {
    const account = await createAccount();
    console.log("連結アカウントの ID:", account.id);
    await printLink(account.id);
  } else {
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.merchant", "requirements"],
    });
    const capabilities = account.configuration?.merchant?.capabilities;
    const cardPayments = capabilities?.card_payments?.status;
    const payouts = capabilities?.stripe_balance?.payouts?.status;
    // 入力が要る項目だけを数える。Stripe が確認している項目(awaiting_action_from が stripe)は含めない。
    const missing = (account.requirements?.entries ?? []).filter(
      (entry) => entry.awaiting_action_from === "user",
    ).length;
    console.log("連結アカウントの ID:", account.id);
    console.log("カード決済:", cardPayments);
    console.log("入金:", payouts);
    console.log("足りない項目の数:", missing);
    if (cardPayments === "active" && payouts === "active") {
      console.log("支払いを受け付けられます。");
    } else if (
      [cardPayments, payouts].every(
        (status) => status === "active" || status === "pending",
      )
    ) {
      // pending は、Stripe が有効にする前の処理をしている状態で、入力は要らない(Stripe の API リファレンス)。
      console.log(
        "Stripe が確認しています。数分待ってから、もう一度実行してください。",
      );
    } else {
      await printLink(account.id);
    }
  }
} catch (err) {
  console.error(
    "Stripe の呼び出しに失敗しました:",
    err.type,
    err.code,
    err.message,
  );
  process.exit(1);
}
