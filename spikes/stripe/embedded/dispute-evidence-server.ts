// 確かめること(IF-038 の手順2。手順は 13-dispute-evidence.ts の冒頭):
// 1件の支払いについて、不審請求の埋め込みコンポーネント(payment-disputes)を表示する。
// 反証資料を途中まで入力し、提出せずに閉じるために使う。返金の操作は見せない(refund_management: false)。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env embedded/dispute-evidence-server.ts <連結アカウントの ID> <PaymentIntent の ID>
// そのあと、ブラウザーで http://localhost:4244 を開く。

import Stripe from "stripe";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
const [accountId = "", payment = ""] = process.argv.slice(2);

if (!(secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) || !publishableKey.startsWith("pk_test_")) {
  console.error("STRIPE_SECRET_KEY にサンドボックスのシークレットキー(sk_test_)か制限付きのキー(rk_test_)を、STRIPE_PUBLISHABLE_KEY に公開可能キー(pk_test_)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || !payment.startsWith("pi_")) {
  console.error("引数に、連結アカウントの ID(acct_ で始まるもの)と、PaymentIntent の ID(pi_ で始まるもの)を指定してください。");
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const page = await readFile(new URL("./dispute-evidence.html", import.meta.url), "utf8");

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page.replaceAll("__PUBLISHABLE_KEY__", publishableKey).replaceAll("__PAYMENT__", payment));
    return;
  }
  if (req.method === "POST" && req.url === "/account_session") {
    try {
      const session = await stripe.accountSessions.create({
        account: accountId,
        components: {
          payment_disputes: {
            enabled: true,
            features: { dispute_management: true, refund_management: false },
          },
        },
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ client_secret: session.client_secret }));
    } catch (err) {
      const e = err as { type?: string; code?: string; message?: string };
      console.error("AccountSession を作れませんでした:", e.type, e.code, e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `${e.type} ${e.code} ${e.message}` }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(4244, "127.0.0.1", () => {
  console.log("API の版:", Stripe.API_VERSION);
  console.log("連結アカウント:", accountId);
  console.log("ブラウザーで http://localhost:4244 を開いてください。止めるときは Ctrl + C。");
});
