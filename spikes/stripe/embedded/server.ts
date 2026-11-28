// 確かめること:
// ダッシュボードなしの生産者のアカウントで、Stripe の埋め込みの画面部品
// (お知らせのバナー、アカウントの管理、残高、書類)が日本のアカウントで表示されるか。
// 部品を使うときに、生産者に Stripe の認証が求められるか、求められるならどんな形か。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env embedded/server.ts <生産者のアカウントの ID>
// そのあと、ブラウザーで http://localhost:4242 を開く。

import Stripe from "stripe";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
const accountId = process.argv[2] ?? "";

if (!(secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) || !publishableKey.startsWith("pk_test_")) {
  console.error("STRIPE_SECRET_KEY にサンドボックスのシークレットキー(sk_test_)か制限付きのキー(rk_test_)を、STRIPE_PUBLISHABLE_KEY に公開可能キー(pk_test_)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_")) {
  console.error("生産者のアカウントの ID(acct_ で始まるもの)を、引数に付けてください。");
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const page = await readFile(new URL("./index.html", import.meta.url), "utf8");

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page.replace("__PUBLISHABLE_KEY__", publishableKey));
    return;
  }
  if (req.method === "POST" && req.url === "/account_session") {
    try {
      const session = await stripe.accountSessions.create({
        account: accountId,
        components: {
          notification_banner: { enabled: true, features: { external_account_collection: true } },
          account_management: { enabled: true, features: { external_account_collection: true } },
          balances: { enabled: true, features: { external_account_collection: true } },
          documents: { enabled: true, features: {} },
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

server.listen(4242, "127.0.0.1", () => {
  console.log("API の版:", Stripe.API_VERSION);
  console.log("生産者のアカウント:", accountId);
  console.log("ブラウザーで http://localhost:4242 を開いてください。止めるときは Ctrl + C。");
});
