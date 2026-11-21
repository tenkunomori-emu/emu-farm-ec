// 確かめること:
// ダッシュボードなしの生産者のアカウントで、Stripe の埋め込みの登録の部品
// (Account onboarding)が日本のアカウントで動くか。
// 生産者が、Stripe のページに移らず、このページの中で入力を終えられるか。
// 入力を終えたあとの状態は、03-account-status.ts で確かめる。
//
// 動かし方(spikes/stripe のフォルダーで):
//   node --env-file=.env embedded/onboarding-server.ts <生産者のアカウントの ID>
// そのあと、ブラウザーで http://localhost:4244 を開く。

import Stripe from "stripe";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
const accountId = process.argv[2] ?? "";

if (!secretKey.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_")) {
  console.error(".env に、サンドボックスの鍵(sk_test_ と pk_test_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!accountId.startsWith("acct_")) {
  console.error("生産者のアカウントの ID(acct_ で始まるもの)を、引数に付けてください。");
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const page = await readFile(new URL("./onboarding.html", import.meta.url), "utf8");

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
          account_onboarding: { enabled: true, features: { external_account_collection: true } },
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

server.listen(4244, "127.0.0.1", () => {
  console.log("API の版:", Stripe.API_VERSION);
  console.log("生産者のアカウント:", accountId);
  console.log("ブラウザーで http://localhost:4244 を開いてください。止めるときは Ctrl + C。");
});
