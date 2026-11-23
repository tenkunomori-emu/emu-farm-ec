// 確かめること:
// 購入手続きを、サイトのページに組み込む形(Checkout Session の ui_mode: elements)で作れるか。
// - 生産者のアカウントの上の支払い(ダイレクト支払い)、仮押さえ、アプリケーション手数料を指定できるか。
// - JCB、ダイナースクラブ、ディスカバーを止める指定(brands_blocked)が、この形でも働くか(FR-225)。
// - 期限(expires_at)を、作ってから1時間にできるか。
// - カードが通らなかったあとと、本人認証を途中でやめたあとに、同じ Checkout Session でやり直せるか。
//   そのとき、Stripe の支払い(PaymentIntent)が1つのままか、増えるか。
// 領収書の税率ごとの消費税(FR-067)は、支払ったあと、08-receipt-tax.ts の receipt で確かめる。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env embedded/checkout-server.ts <生産者のアカウントの ID>
//   止める指定を付けないとき(Link にカードを保存するとき): 最後に noblock を付ける。
//   領収書の言語を確かめるとき: 最後に ja(Checkout Session に locale: "ja")か、jacustomer(言語に ja を指定した Customer を付ける)を付ける。
// そのあと、ブラウザーで http://localhost:4245 を開く。

import Stripe from "stripe";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
const [accountId = "", option = ""] = process.argv.slice(2);

if (!secretKey.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_")) {
  console.error(".env に、サンドボックスの鍵(sk_test_ と pk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || !["", "noblock", "ja", "jacustomer"].includes(option)) {
  console.error("引数は「<acct_...>」か、そのあとに noblock、ja、jacustomer のどれかを付けた形にしてください。");
  process.exit(1);
}

const block = option !== "noblock";
const purpose = "spike-09-checkout-elements";
const stripe = new Stripe(secretKey);
const onAccount = { stripeAccount: accountId };
const page = await readFile(new URL("./checkout.html", import.meta.url), "utf8");

const reduced = await stripe.taxRates.create(
  { display_name: "消費税(軽減税率)", percentage: 8, inclusive: true, country: "JP", tax_type: "jct" },
  onAccount,
);
const standard = await stripe.taxRates.create(
  { display_name: "消費税", percentage: 10, inclusive: true, country: "JP", tax_type: "jct" },
  onAccount,
);

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function describe(err: unknown) {
  const e = err as { type?: string; code?: string; message?: string };
  return `${e.type} ${e.code} ${e.message}`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost:4245");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      page
        .replaceAll("__PUBLISHABLE_KEY__", publishableKey)
        .replaceAll("__ACCOUNT_ID__", accountId)
        .replaceAll("__BLOCK__", block ? "あり" : "なし"),
    );
    return;
  }

  // 購入手続き(Checkout Session)を作る。中身は 08-receipt-tax.ts と同じ。
  if (req.method === "POST" && url.pathname === "/session") {
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
      const customer =
        option === "jacustomer" ? await stripe.customers.create({ preferred_locales: ["ja"] }, onAccount) : null;
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          ui_mode: "elements",
          line_items: [
            {
              quantity: 1,
              price_data: { currency: "jpy", unit_amount: 1080, product_data: { name: "方式検証の商品(食品・軽減税率)" } },
              tax_rates: [reduced.id],
            },
            {
              quantity: 1,
              price_data: { currency: "jpy", unit_amount: 1100, product_data: { name: "送料" } },
              tax_rates: [standard.id],
            },
          ],
          payment_intent_data: {
            capture_method: "manual",
            application_fee_amount: 162,
            metadata: { purpose },
          },
          ...(block
            ? { payment_method_options: { card: { restrictions: { brands_blocked: ["discover_global_network"] } } } }
            : {}),
          expires_at: expiresAt,
          return_url: "http://localhost:4245/?returned=1",
          ...(option === "ja" ? { locale: "ja" as const } : {}),
          ...(customer ? { customer: customer.id } : {}),
        },
        onAccount,
      );
      console.log("購入手続き(Checkout Session)を作った:", session.id);
      console.log("  領収書の言語の指定:", option === "ja" ? "locale ja" : customer ? `Customer ${customer.id}(ja)` : "なし");
      console.log("  期限:", new Date((session.expires_at ?? 0) * 1000).toISOString(), "/ 止める指定:", JSON.stringify(session.payment_method_options?.card?.restrictions ?? null));
      sendJson(res, 200, { id: session.id, client_secret: session.client_secret });
    } catch (err) {
      console.error("購入手続きを作れなかった:", describe(err));
      sendJson(res, 500, { error: describe(err) });
    }
    return;
  }

  // 購入手続きと、その支払い(PaymentIntent)の今の状態を読む。
  if (req.method === "GET" && url.pathname === "/status") {
    try {
      const id = url.searchParams.get("id") ?? "";
      const session = await stripe.checkout.sessions.retrieve(id, {}, onAccount);
      const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      const intent = intentId ? await stripe.paymentIntents.retrieve(intentId, {}, onAccount) : null;
      const recent = await stripe.paymentIntents.list({ limit: 20 }, onAccount);
      const body = {
        session: { id: session.id, status: session.status, payment_status: session.payment_status, amount_total: session.amount_total },
        payment_intent: intent
          ? { id: intent.id, status: intent.status, amount: intent.amount, amount_capturable: intent.amount_capturable, application_fee_amount: intent.application_fee_amount }
          : null,
        // この方式検証で作られた支払いの一覧(新しい順)。やり直しで支払いが増えるかを見る。
        recent_payment_intents: recent.data
          .filter((p) => p.metadata.purpose === purpose)
          .map((p) => ({ id: p.id, status: p.status, amount: p.amount, created: new Date(p.created * 1000).toISOString() })),
      };
      console.log("状態:", JSON.stringify(body, null, 2));
      sendJson(res, 200, body);
    } catch (err) {
      console.error("状態を読めなかった:", describe(err));
      sendJson(res, 500, { error: describe(err) });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(4245, "127.0.0.1", () => {
  console.log("API の版:", Stripe.API_VERSION);
  console.log("生産者のアカウント:", accountId, "/ JCB などを止める指定:", block ? "あり" : "なし");
  console.log("税率:", reduced.id, "(8%)", standard.id, "(10%)");
  console.log("ブラウザーで http://localhost:4245 を開いてください。止めるときは Ctrl + C。");
});
