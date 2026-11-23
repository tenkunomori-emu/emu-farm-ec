# ADR-0012: 購入手続きをサイトに組み込む Checkout Session で作り、Stripe の知らせは合図として使う

- 日付: 2026-11-23
- ステータス: 採用

## 背景

- 基本設計書([02-basic-design.md](../02-basic-design.md))の「状態遷移と、決済と送金の流れ」は、購入者が「購入を確定する」を押すたびに、サイトが Stripe の支払いを直接作る形で書かれていた。
- 領収書を出すのは Stripe である(SYS-006)。税率ごとの消費税が出る領収書(FR-067)と、JCB、ダイナースクラブ、ディスカバーのカードを支払いの前に止める指定(FR-225)は、Stripe の画面へ移る形の Checkout Session で確かめてあった(ADR-0009([0009-stripe-account-onboarding-and-spike-results.md](0009-stripe-account-onboarding-and-spike-results.md)))。サイトのページに組み込む形で同じに働くかは、確かめていなかった(ADR-0009 の「影響とリスク」)。
- 購入者の操作は、できる限り少なくする。購入者を Stripe の画面へ移すと、ページが1つ増える。
- 外部のサービスのうち、メールを送るサービスと、アクセス解析は、どれを使うかが決まっていなかった(基本設計書の SYS-007、SYS-008)。
- Stripe の知らせは、重なって届くことも、順番が入れ替わることも、届かないこともある(NFR-009)。受け方の方式は、決まっていなかった(SYS-023)。
- そのため、基本設計の「外部連携と知らせ」の章を書く前に、Stripe のサンドボックスで、方式検証のコード([spikes/stripe/](../../spikes/stripe/)の embedded/、09-checkout-expire.ts、10-payment-brand.ts)を動かして確かめた(2026年11月23日)。使った API の版は 2026-11-18.endive、stripe のライブラリは 23.2.0 である。確かめた記録は、議事録と同じく、このリポジトリの外に置いている。

## 検討した選択肢

### 購入手続きの作り方

| 選択肢 | 確かめた結果 | 判断 |
|---|---|---|
| サイトが、Stripe の支払いを直接作る | Stripe の公式ページ「Receipts」は、明細と税が載る領収書を、請求書とサブスクリプションの支払いのものとしている(動かしては、確かめていない)。ブランドを止める指定も、Checkout Session の機能である | 採らない。税率ごとの消費税が出る領収書を、サイトが作ることになる |
| Stripe の画面へ移る形の Checkout Session | ADR-0009 で確かめてある | 採らない。購入者のページが1つ増える。組み込む形が通らなかったときの、控えの案とした |
| **サイトのページに組み込む形の Checkout Session** | 下の「確認できた事実」のとおり、通った | **採用**。ボタンは、サイトの「購入を確定する」のままで、ページが増えない |

### 購入手続きの途中で、額か、アプリケーション手数料の率が変わったとき

| 選択肢 | 確かめた結果 | 判断 |
|---|---|---|
| Checkout Session の明細を書き換える | 明細は書き換えられるが、アプリケーション手数料の額は、書き換えられる項目にない(stripe のライブラリの型で確かめた。動かしてはいない) | 採らない。手数料が、古い額のまま残る |
| **Checkout Session を終わらせて、作り直す** | 終わっていない Checkout Session を終わらせると、その支払いは、Stripe が取り消した。仮押さえに成功した Checkout Session は、終わらせられず、仮押さえは残った | **採用**。終わらせる求めの結果で、作り直すか、注文を作る処理に進むかが、決まる |

### Stripe の知らせの扱い

| 選択肢 | 判断 |
|---|---|
| 知らせに入っている中身で、状態を決める。受けた知らせを記録して、重なりを見分ける | 採らない。順番が入れ替わったときに、古い中身で状態を戻すことがある。知らせには、購入者の個人情報が入っており、写しをサイトが持つことになる |
| **知らせを合図として使い、知らせが指すものを Stripe から読み直す** | **採用**。どの順で、何回届いても、読み直した今の状態で決まる。受けた知らせを記録する実体は、要らない |

### メールを送るサービスと、アクセス解析

| 選ぶもの | 選んだもの | 理由 |
|---|---|---|
| メールを送るサービス | Resend | 同じ鍵を付けたメールを、二重に送らない仕組みがある。宛先に届かなかったことを、知らせで受けられる(NFR-022) |
| アクセス解析 | Vercel の Web Analytics と Speed Insights | Cookie を使わず、訪問者を、届いた求めから作るハッシュで見分ける(NFR-016)。送る前に中身を変えるか、送らないかを決める指定がある(NFR-015)。サイトを動かす Vercel の機能で、個人情報を渡す先が増えない |

専用のファネルの画面を持つ、ほかの解析のサービスは、仕様を確かめておらず、比べていない。購入までの進み具合(FR-259)は、段ごとの数で確かめる形にした(基本設計書の IF-007)。

## 決定

1. 購入手続きは、サイトのページに組み込む形の Checkout Session で作る。送り先が入り、額が決まったところで、サーバーが、生産者の Stripe のアカウントの上に作る。「購入を確定する」が押されたら、サーバーが額と率を計算し直し、変わっていなければ、ブラウザが Stripe に支払いを送る(基本設計書の SYS-027、IF-016、IF-021〜IF-029、「注文と支払い」の節)。
2. 額か率が変わっていたら、Checkout Session を終わらせてから、作り直す。期限の処理も、終わらせる求めを出し、その結果で分ける(SYS-019、TRN-061)。
3. カードのブランドは、画面の止める指定と、サーバーの確かめの2段で確かめる。サーバーは、Visa、Mastercard、American Express と読めたときだけ、注文にする(「注文を受け付ける条件」、IF-025、ADR-0008([0008-jcb-acceptance.md](0008-jcb-acceptance.md)))。
4. 購入者のメールアドレスは、Stripe の入力欄で入れてもらい、サイトは、仮押さえに成功したあと、Checkout Session から読む。ログインしている会員には、登録のメールアドレスを、前もって入れて示す(IF-026)。
5. Link は、MVP では使わない指定にする(IF-024)。確定した要件定義書(FR-044、FR-225)の文は、次の版で直す。MVP の完了のあとに、Link を足す。
6. 領収書は、注文の画面から、Stripe の領収書のページを開く形で届ける。Stripe が領収書をメールで送ることには、頼らない(IF-018)。
7. Stripe の知らせは、合図として使い、知らせが指すものを Stripe から読み直して、データベースを合わせる。受けた知らせを記録する実体は、持たない。届かない知らせは、Stripe の送り直しと、定期の突き合わせで拾う(IF-042〜IF-053)。
8. メールを送るサービスは Resend、アクセス解析は Vercel の Web Analytics と Speed Insights を使う(IF-002〜IF-008)。

## 確認できた事実(サンドボックスと公式ページ、2026-11-23時点)

テストは、ADR-0009 と同じ、日本の個人のテスト用の生産者のアカウントで行った。購入手続きは、軽減税率 8% の商品 1,080円と、標準税率 10% の送料 1,100円で、アプリケーション手数料は 162円である。

| 確かめたこと | 結果 |
|---|---|
| 組み込む形の Checkout Session を、生産者のアカウントの上に、仮押さえの指定で作る | 作れた。期限を、作ってから1時間に指定できた。仮押さえに成功すると、Checkout Session は完了になり、支払いは、アプリケーション手数料が付いた、仮押さえの状態になった |
| カードのブランドを止める指定 | JCB、ダイナースクラブ、ディスカバーのテスト用のカードは、カード番号を入れた時点で、使えないと表示された。Visa は、支払えた |
| 領収書 | 代金を確定すると、Stripe の領収書のページに、税率ごとの消費税が、別の行で出た。見出しは、英語だった |
| メールアドレス | 組み込む形では、必須だった。空のときは、「購入を確定する」を押せなかった |
| Link の登録の枠 | カードの欄の下に、携帯電話番号と氏名の欄が出た。触らなければ、支払えた。一度入力してから消すと、支払えなかった |
| カードが通らなかったあと、本人認証に失敗したあとのやり直し | Checkout Session は終わらず、同じ画面でカードを替えて、支払えた。支払いは、同じ1つが使われ、失敗した回に、仮押さえは残らなかった |
| 本人認証の途中で、別のタブから支払う | 仮押さえは、1つだけだった。あとから本人認証を済ませても、二重にならなかった |
| 終わっていない Checkout Session を終わらせる | Checkout Session は終わり、その支払いは、Stripe が取り消した。本人認証の途中でも、同じだった。そのあと本人認証を済ませても、仮押さえは成功しなかった |
| 仮押さえに成功した Checkout Session を終わらせる | Stripe が断り、仮押さえは残った |
| Checkout Session の期限が来る | サイトが何もしなくても、Checkout Session は終わり、その支払いは、Stripe が取り消していた(期限のおよそ20分あとに読んだ) |
| サーバーが、支払いからカードのブランドを読む | 読めた(JCB のカードは jcb、Visa のカードは visa) |
| Link に保存されたカードが、止める指定で止まるか | 確かめられなかった。このページでは、Link が、保存したカードを出さなかった |

公式ページで確かめたこと:

- Checkout Session の期限は、作ってから30分より短くできない(「Create a Checkout Session」)。
- 受け取れなかった知らせは、Stripe が、あとで送り直す(「Process undelivered webhook events」)。
- Accounts v2 で作ったアカウントは、v1 の形の知らせと、v2 の形の知らせの両方を出す(「Use the Accounts v2 API in your existing integration」)。

## 影響とリスク

- 状態遷移の章の、仮押さえの「回」ごとの扱い(前の回の支払いを取り消してから、新しい回を始める)は、なくなった。1つの Checkout Session が持つ支払いは1つで、やり直しは、Stripe の中で行われる。支払いの操作の試み(ENT-015)は、Checkout Session を作る試みを記録する形に変えた。
- 購入者が、サイトの確かめを通さずに支払いを送ると、額が変わる前の Checkout Session で、仮押さえに成功することがある。払えるのは、サーバーが決めて本人に示した額だけで、注文にするかどうかは、仮押さえのあとに、サーバーが決める(「注文と支払い」の節の注記)。
- 領収書は、代金を確定する前には、開けない。税率ごとの消費税は、注文の確認にも出す(FR-067、IF-059)。
- 管理者(オーナー)は、アクセス解析を、Vercel の画面で見る。管理者には、読むだけの役割を渡す(IF-008)。
- 実装のテストで確かめること:
  - ボタンを続けて押したときに、仮押さえが二重にならないか。
  - 終わらせる求めと、仮押さえの成功が、ほぼ同時に起きたときに、どちらか一方に決まるか。
  - どの種類の Stripe の知らせが、どの順で届くか(仮押さえの成功、失敗、Checkout Session の終わり、返金、不審請求、アカウントの状態)。生産者のアカウントの状態の知らせを、v1 の形と v2 の形のどちらで受けるか(IF-053)。
  - Link を使わない指定を付けたときに、登録の枠が出なくなるか。
  - 領収書の見出しを、日本語にできるか。
  - 残高の部品に、入金の一覧が出るか(IF-015)。
  - サイトが API で前もって入れた証拠が、不審請求の部品の画面に出るか(IF-035)。役割が外れる前に、部品で入れかけた証拠が、証拠のページで読めるか。
  - 証拠を出す期限を過ぎたあと、前から開いていた部品からの操作を、Stripe が断るか(IF-040)。
  - Speed Insights が、Cookie も、端末に残る識別子も書かないか(NFR-016)。サーバーから出来事を送ったときに、注文の完了が数えられるか(IF-007)。
  - 読むだけの役割で、Vercel の画面の、秘密の鍵の値が見えないか(IF-008)。
- 本番で確かめること(サンドボックスでは、確かめられない):
  - Apple Pay と Google Pay に入った JCB、ダイナースクラブ、ディスカバーのカードが、止める指定で止まるか。その支払いから、サーバーがカードのブランドを読めるか。
  - 日本の携帯電話会社のメールアドレスに、サイトのメールが届くか。
  - Checkout Session の期限の時刻から、Stripe が終わらせるまでの時間。設計は、サイトの期限の処理からも終わらせるため、この時間に頼っていない。
- MVP のあとに足すもの(Issue に残す): Link(足す前に、Link に保存されたカードで、止める指定が働くことと、サーバーがブランドを読めることを確かめる)。

## 合意の記録

議事録_2026_1123

## 参考にした情報

- [Stripe: Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe: Customize card brands](https://docs.stripe.com/payments/checkout/customization/card-brands)
- [Stripe: Process undelivered webhook events](https://docs.stripe.com/webhooks/process-undelivered-events)
- [Stripe: Use the Accounts v2 API in your existing integration](https://docs.stripe.com/connect/accounts-v2/migrate-integration)
- [Stripe: Account event types](https://docs.stripe.com/api/v2/core/accounts/event-types)
- [Vercel: Vercel Web Analytics](https://vercel.com/docs/analytics)
- [Vercel: Redacting Sensitive Data from Web Analytics Events](https://vercel.com/docs/analytics/redacting-sensitive-data)
- [Vercel: Speed Insights Configuration](https://vercel.com/docs/speed-insights/package)
- [Vercel: Access Roles](https://vercel.com/docs/rbac/access-roles)
- [Resend: Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend: Event Types](https://resend.com/docs/dashboard/webhooks/event-types)
