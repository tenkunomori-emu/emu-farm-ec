import Stripe from "stripe";
import { describe, expect, it } from "vitest";

// サンドボックスの鍵と、テスト用の連結アカウント(TST-024)で、Stripe を呼べることを確かめる
describe("テスト用の連結アカウント", () => {
  it("カード決済と入金が有効である", async () => {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    const accountId = process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID ?? "";
    // OPS-010 と同じ考え方で、本番の鍵では、テストを動かさない
    expect(
      key.startsWith("sk_test_"),
      "STRIPE_SECRET_KEY がサンドボックスの鍵ではありません",
    ).toBe(true);
    expect(
      accountId.startsWith("acct_"),
      "STRIPE_TEST_CONNECTED_ACCOUNT_ID がありません",
    ).toBe(true);

    const stripe = new Stripe(key);
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.merchant"],
    });
    const capabilities = account.configuration?.merchant?.capabilities;

    expect(capabilities?.card_payments?.status).toBe("active");
    expect(capabilities?.stripe_balance?.payouts?.status).toBe("active");
  });
});
