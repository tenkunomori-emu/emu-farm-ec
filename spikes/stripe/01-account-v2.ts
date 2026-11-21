// 確かめること:
// 生産者のアカウントを、Accounts v2 の正式な版で、次の設定のまま作れるか。
// - ダッシュボードなし(dashboard: none)
// - Stripe の手数料は生産者が払う(defaults.responsibilities.fees_collector: stripe)
// - マイナス残高の責任は Stripe(defaults.responsibilities.losses_collector: stripe)
// - 情報の収集は Stripe(requirements_collector。Accounts v2 では指定できず、
//   上の2つから Stripe が決める。作ったあとの値を読んで確かめる)
// 作れたときは、Stripe が返した設定と、入力が足りない項目を表示する。

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY に、サンドボックスの鍵(sk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}

const stripe = new Stripe(key);

try {
  const account = await stripe.v2.core.accounts.create({
    contact_email: "producer-spike@example.com",
    display_name: "方式検証の生産者",
    dashboard: "none",
    identity: {
      country: "jp",
      entity_type: "individual",
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
    },
    defaults: {
      currency: "jpy",
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    metadata: { purpose: "spike-01-account-v2" },
    include: ["configuration.merchant", "defaults", "identity", "requirements"],
  });

  console.log("API の版:", Stripe.API_VERSION);
  console.log("アカウントの ID:", account.id);
  console.log("ダッシュボード:", account.dashboard);
  console.log("責任の分担:", JSON.stringify(account.defaults?.responsibilities, null, 2));
  console.log("カード決済の状態:", JSON.stringify(account.configuration?.merchant?.capabilities?.card_payments, null, 2));
  console.log("足りない項目:", JSON.stringify(account.requirements, null, 2));
} catch (err) {
  const e = err as { type?: string; code?: string; message?: string };
  console.error("作れなかった:", e.type, e.code, e.message);
  process.exit(1);
}
