// 確かめること:
// 不審請求の部品(Disputes for a payment)を、ダッシュボードなしの生産者のアカウントで使えるか。
// - 返金の操作を見せずに(refund_management: false)、証拠を出す操作だけを使えるか(FR-098)。
// - 証拠を出す期限が、部品の中に見えるか(FR-266)。
// - 部品を使う許可(AccountSession)を、1件の支払いに絞れるか(FR-238、FR-239)。
//   ページには、同じ許可で2件の支払いの部品を並べる。2件目も表示されるなら、
//   許可は1件に絞れず、ほかの支払いにも届く。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env embedded/dispute-server.ts <生産者のアカウントの ID> <1件目の PaymentIntent の ID> <2件目の PaymentIntent の ID>
// そのあと、ブラウザーで http://localhost:4243 を開く。

import Stripe from "stripe";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
const [accountId = "", firstPayment = "", secondPayment = ""] = process.argv.slice(2);

if (!secretKey.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_")) {
  console.error(".env に、サンドボックスの鍵(sk_test_ と pk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_") || !firstPayment.startsWith("pi_") || !secondPayment.startsWith("pi_")) {
  console.error("引数に、生産者のアカウントの ID(acct_)と、PaymentIntent の ID(pi_)を2つ付けてください。");
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const page = await readFile(new URL("./dispute.html", import.meta.url), "utf8");

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      page
        .replaceAll("__PUBLISHABLE_KEY__", publishableKey)
        .replaceAll("__FIRST_PAYMENT__", firstPayment)
        .replaceAll("__SECOND_PAYMENT__", secondPayment),
    );
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
      console.error("AccountSession を作れなかった:", e.type, e.code, e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `${e.type} ${e.code} ${e.message}` }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(4243, "127.0.0.1", () => {
  console.log("API の版:", Stripe.API_VERSION);
  console.log("生産者のアカウント:", accountId);
  console.log("ブラウザーで http://localhost:4243 を開いてください。止めるときは Ctrl + C。");
});
