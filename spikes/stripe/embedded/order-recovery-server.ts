// 確かめること(OPS-026 の手順1。手順は 14-order-recovery-values.ts の冒頭):
// 注文を作り直すときに Stripe から読む値(OPS-026)を確かめるため、サイトと同じ形の購入手続きで、1件支払う。
// - Checkout Session(ui_mode: elements)を、連結アカウントの上に、オーソリだけの指定で作る(IF-021)。
// - 明細は、商品(2個、軽減税率)と送料(標準税率)を別の行にし、行ごとに税込みの税率を付ける(IF-022)。
// - Checkout Session と、その支払いに、購入手続きを見分ける ID と、商品の ID だけを付ける(SYS-012)。
// 画面は、09 の方式検証と同じ embedded/checkout.html を使う。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env embedded/order-recovery-server.ts <連結アカウントの ID>
// そのあと、ブラウザーで http://localhost:4246 を開く。

import Stripe from "stripe";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
const accountId = process.argv[2] ?? "";

if (!(secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) || !publishableKey.startsWith("pk_test_")) {
  console.error("STRIPE_SECRET_KEY にサンドボックスのシークレットキー(sk_test_)か制限付きのキー(rk_test_)を、STRIPE_PUBLISHABLE_KEY に公開可能キー(pk_test_)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_")) {
  console.error("引数に、連結アカウントの ID(acct_ で始まるもの)を指定してください。");
  process.exit(1);
}

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
  const url = new URL(req.url ?? "/", "http://localhost:4246");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      page
        .replaceAll("__PUBLISHABLE_KEY__", publishableKey)
        .replaceAll("__ACCOUNT_ID__", accountId)
        .replaceAll("__BLOCK__", "あり"),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/session") {
    try {
      // サイトでは、購入手続きと商品の記録の ID を付ける。方式検証では、その代わりに UUID を作る。
      const ids = { purchase_id: randomUUID(), product_id: randomUUID() };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          ui_mode: "elements",
          line_items: [
            {
              quantity: 2,
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
            application_fee_amount: 324,
            metadata: ids,
          },
          metadata: ids,
          payment_method_options: { card: { restrictions: { brands_blocked: ["discover_global_network"] } } },
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
          return_url: "http://localhost:4246/?returned=1",
        },
        onAccount,
      );
      console.log("購入手続き(Checkout Session)を作りました:", session.id);
      console.log("  purchase_id:", ids.purchase_id, "/ product_id:", ids.product_id);
      sendJson(res, 200, { id: session.id, client_secret: session.client_secret });
    } catch (err) {
      console.error("購入手続きを作れませんでした:", describe(err));
      sendJson(res, 500, { error: describe(err) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    try {
      const session = await stripe.checkout.sessions.retrieve(url.searchParams.get("id") ?? "", { expand: ["payment_intent"] }, onAccount);
      const intent = typeof session.payment_intent === "string" ? null : session.payment_intent;
      const body = {
        session: { id: session.id, status: session.status, payment_status: session.payment_status, amount_total: session.amount_total },
        payment_intent: intent ? { id: intent.id, status: intent.status, amount: intent.amount } : null,
      };
      console.log("状態:", JSON.stringify(body));
      sendJson(res, 200, body);
    } catch (err) {
      console.error("状態を読めませんでした:", describe(err));
      sendJson(res, 500, { error: describe(err) });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(4246, "127.0.0.1", () => {
  console.log("API の版:", Stripe.API_VERSION);
  console.log("連結アカウント:", accountId);
  console.log("ブラウザーで http://localhost:4246 を開いてください。止めるときは Ctrl + C。");
});
