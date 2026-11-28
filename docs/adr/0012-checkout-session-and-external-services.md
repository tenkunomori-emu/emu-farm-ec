# ADR-0012: 購入手続きをサイトに組み込む Checkout Session で作り、Stripe の知らせは合図として使う

- 日付: 2026-11-23
- ステータス: 採用
- 更新(2026-11-28): 不審請求の自動提出、証拠のページから出したときの中身、生産者のアカウントの状態の知らせを、検証のサンドボックスで確かめた(Issue #221)。「決定」の9〜12と「確認できた事実(2026-11-28 の追加、Issue #221)」を足し、「影響とリスク」を直した。

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
9. 不審請求の自動提出(Smart Disputes の自動対応)は、開発、CI、検証のサンドボックスと本番のすべてで、Connect の不審請求の設定でオフにし、連結アカウントによる変更を許可しない。本番の設定は、リリースのときに行う。オンだと、生産者が何もしなくても、Stripe が期限に反証資料を出し(IF-035 と食い違う)、生産者が足した反証資料に、Stripe が作ったデータを合わせて出す(IF-038 と食い違う)。勝つと、不審請求の額の30%の Smart Disputes の手数料もかかる。連結アカウントごとの設定は、公開プレビューの API でしか使えないため、使わない。
10. サイトは、不審請求か照会が作られた知らせ(IF-052 の charge.dispute.created)を受けたら、その提出方法(intended_submission_method)を、提出しない指定(submit: false)を付けて manual にする(IF-035、TRN-027、TRN-030)。既定の prefer_manual は、反証資料を上げていなければ Smart Disputes を使う、という意味である。
11. 証拠のページ(IF-038)から出すときは、ページで入力しなかった反証資料の項目を、すべて空("")にして出す。部品で入れかけた中身は、出さなくても、Stripe の反証資料に残るためである。
12. 生産者のアカウントの状態の知らせ(IF-053)は、v2 の thin のイベントの v2.core.account[configuration.merchant].capability_status_updated と v2.core.account[requirements].updated で受け、v1 の account.updated は受けない。v2 のイベントは、プラットフォームのアカウントの範囲(Your account)の送信先で受ける。Stripe が、Accounts v2 のアカウントには v2 のイベントを、新しい作りには thin の形を勧めているためである。IF-049〜IF-052 の形は、Issue #223 で決める。

## 確認できた事実(サンドボックスと公式ページ、2026-11-23時点)

テストは、ADR-0009 と同じ、日本の個人のテスト用の生産者のアカウントで行った。購入手続きは、軽減税率 8% の商品 1,080円と、標準税率 10% の送料 1,100円で、アプリケーション手数料は 162円である。

| 確かめたこと | 結果 |
|---|---|
| 組み込む形の Checkout Session を、生産者のアカウントの上に、仮押さえの指定で作る | 作れた。期限を、作ってから1時間に指定できた。仮押さえに成功すると、Checkout Session は完了になり、支払いは、アプリケーション手数料が付いた、仮押さえの状態になった |
| カードのブランドを止める指定 | JCB、ダイナースクラブ、ディスカバーのテスト用のカードは、カード番号を入れた時点で、使えないと表示された。Visa は、支払えた |
| 領収書 | 代金を確定すると、Stripe の領収書のページに、税率ごとの消費税が、別の行で出た。見出しは、英語だった。Checkout Session に言語 ja を付けても、見出しは英語のままだった(商品の名前と税の名前は、付けた日本語のまま出る) |
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

## 確認できた事実(2026-11-28 の追加、Issue #221)

検証のサンドボックスで、確かめ用の生産者のアカウントを2つ登録して使った(ADR-0009 の「確認できた事実(2026-11-28 の追加、Issue #221)」)。方式検証のコードは、[spikes/stripe/](../../spikes/stripe/) の 11-account-events.ts、12-funding-and-disputes.ts、13-dispute-evidence.ts、embedded/dispute-evidence-server.ts である。

| 確かめたこと | 結果 |
|---|---|
| Connect の不審請求の設定の、最初の値 | 検証のサンドボックスでは、「自動対応を有効にする」がオン、「連結アカウントが Smart Disputes の自動応答を有効または無効にする」が「許可する」だった。開発、CI、検証のサンドボックスを、「決定」の9のとおりに変えた |
| 不審請求が作られたときの提出方法 | 1つ目の確かめ用のアカウントで起こした2件の不審請求は、どちらも、提出方法(intended_submission_method)が prefer_manual、反証資料の提出の方法(evidence_details.submission_method)が not_submitted だった。1件を、API で submit: false を付けて manual に変えられた。stripe のライブラリ 23.2.0 では、submit の既定は true で、付けないとすぐに出される |
| 部品で入れかけた反証資料 | 不審請求の部品で入力した中身(顧客の名前、商品の説明)は、出さなくても、Stripe の反証資料に保存された。そのあと API で別の項目を足しても(submit: false)、部品で入れた項目は残った |
| ページで入力しなかった項目を空にして出す | 空("")にした項目は出されず、API で送った項目だけが出された(提出の方法は manual、提出の回数は1)。テスト用の値で勝った。ファイルの項目は確かめていない |
| 生産者のアカウントの状態の知らせ | 登録から有効になるまでに、v1 の account.updated と、v2 の capability_status_updated と requirements.updated が記録された。v1 は v2 より7〜16秒早かった。v1 の知らせには、アカウント全体の写し(メールアドレス、電話番号、住所、口座の名義と下4桁)が入っていた。v2 の changes には、カード決済が restricted から active に変わったことと、要件の変化が入っていた。ウェブサイトの変更では、v1 は出たが、v2 の2つの種類は出なかった |
| 送信先がないときの v2 の知らせ | 送信先がなくても記録され、Events v2 API で読めた。capability_status_updated は、カード決済と入金のほかに、jcb_payments でも出た |

公式ページで確かめたこと:

- 自動対応をオフにすると、期限までに応じなかった不審請求は、受け入れたことになり、負ける(「Configure auto-respond settings for Smart Disputes」)。
- Smart Disputes の手数料は、勝ったときだけ、不審請求の額の30%かかる(Stripe の料金のページ)。
- 提出方法の manual は、Smart Disputes を使わない。prefer_manual は、反証資料を上げていなければ Smart Disputes を使う(「Adds the ability to choose how you submit a dispute response」)。プラットフォームの設定をオフにしたときとの組み合わせは、書かれていない。
- Accounts v2 のアカウントの v2 の知らせは、プラットフォームのアカウントの範囲(Your account)に、v1 の知らせは、連結アカウントの範囲(Connected accounts)に届く。Stripe は、v2 の知らせを受ける新しい送信先を勧め、v1 の account.updated を受けないように書いている(「Use the Accounts v2 API in your existing integration」「Charge SaaS fees to your connected accounts」)。
- 送信先は、thin か snapshot のどちらか1つの形で受ける。Stripe は、新しい作りには thin を勧めている(「How events work」)。v1 のリソースの thin の知らせは、2026年9月30日から正式に使える(「Makes thin events for API v1 resources generally available」)。

## 影響とリスク

- 状態遷移の章の、仮押さえの「回」ごとの扱い(前の回の支払いを取り消してから、新しい回を始める)は、なくなった。1つの Checkout Session が持つ支払いは1つで、やり直しは、Stripe の中で行われる。支払いの操作の試み(ENT-015)は、Checkout Session を作る試みを記録する形に変えた。
- 購入者が、サイトの確かめを通さずに支払いを送ると、額が変わる前の Checkout Session で、仮押さえに成功することがある。払えるのは、サーバーが決めて本人に示した額だけで、注文にするかどうかは、仮押さえのあとに、サーバーが決める(「注文と支払い」の節の注記)。
- 領収書は、代金を確定する前には、開けない。税率ごとの消費税は、注文の確認にも出す(FR-067、IF-059)。
- 管理者(オーナー)は、アクセス解析を、Vercel の画面で見る。管理者には、読むだけの役割を渡す(IF-008)。
- メールを送るサービスが、二重に送らないための鍵を覚えているのは、24時間である。結果が分からなかった送信を、24時間を過ぎてから送り直すと、同じメールが2通届くことがある。届かないよりも害が小さいため、送り直しを続ける(IF-105)。
- 生産者の役割が外れた生産者にも、Stripe が情報を求めていることと、入金が止まったことを知らせる(IF-083、FR-260)。ただし、役割が外れた生産者には、Stripe の部品を使う許可を出さないため、サイトの中で情報を出す手段がない。退会できるのは、最後の発送から120日がたったあとで(NFR-003)、入金が残っている例は少ない。手段を作るかは、MVP のあとに決める。
- 実装のテストで確かめること:
  - ボタンを続けて押したときに、仮押さえが二重にならないか。
  - 終わらせる求めと、仮押さえの成功が、ほぼ同時に起きたときに、どちらか一方に決まるか。
  - どの種類の Stripe の知らせが、どの順で届くか(仮押さえの成功、失敗、Checkout Session の終わり、返金、不審請求、アカウントの状態)。生産者のアカウントの状態の知らせの形は、「決定」の12で決めた。
  - Link を使わない指定を付けたときに、登録の枠が出なくなるか。
  - 領収書の見出しを、言語を ja にした Customer を付けると、日本語にできるか(MVP は、英語の見出しのままでよいとした)。
  - 残高の部品に、入金の一覧が出るか(IF-015)。入金を待つ必要があるため、Issue #222 で確かめる。
  - 生産者が何もしないとき、Stripe が、不審請求の証拠を自動でまとめて出すことがあるか(IF-035)。自動対応をオフにした設定で、提出方法が prefer_manual のままの不審請求が、期限に出されるかを、Issue #222 で確かめる。証拠のページ(IF-038)から出したときの中身は、「確認できた事実(2026-11-28 の追加、Issue #221)」のとおり確かめた。ファイルの項目を空にできるかは、不審請求の機能のテストで確かめる。
  - 証拠を出す期限を過ぎたあと、前から開いていた部品からの操作を、Stripe が断るか(IF-040)。期限を待つ必要があるため、Issue #222 で確かめる。
  - Speed Insights が、Cookie も、端末に残る識別子も書かないか(NFR-016)。サーバーから出来事を送ったときに、注文の完了が数えられるか(IF-007)。
  - 読むだけの役割で、Vercel の画面の、秘密の鍵の値が見えないか(IF-008)。
  - 運送会社の追跡のページを、伝票番号を付けたリンクで、直接開けるか(SCR-005)。開けない運送会社は、設定の値を、追跡の入口のページにする。
- 本番で確かめること(サンドボックスでは、確かめられない):
  - Apple Pay と Google Pay に入った JCB、ダイナースクラブ、ディスカバーのカードが、止める指定で止まるか。その支払いから、サーバーがカードのブランドを読めるか。
  - 日本の携帯電話会社のメールアドレスに、サイトのメールが届くか。
  - Checkout Session の期限の時刻から、Stripe が終わらせるまでの時間。設計は、サイトの期限の処理からも終わらせるため、この時間に頼っていない。
- 本番の Connect の不審請求の設定は、リリースのときに、検証のサンドボックスと同じにする(「決定」の9)。オフにすると、生産者が期限までに応じなかった不審請求は、負ける。
- 生産者のアカウントの状態の知らせ(「決定」の12)は、IF-049〜IF-052 の知らせと届く範囲が違うため、送信先と署名の鍵が分かれる(IF-042、OPS-009。基本設計書への反映は Issue #210)。IF-049〜IF-052 の形と、送信先の数は、Issue #223 で決める。
- MVP のあとに足すもの(Issue に残す): Link(足す前に、Link に保存されたカードで、止める指定が働くことと、サーバーがブランドを読めることを確かめる)。

## 合意の記録

議事録_2026_1123、議事録_2026_1128

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
- [Stripe: Configure auto-respond settings for Smart Disputes](https://docs.stripe.com/disputes/smart-disputes/auto-respond)
- [Stripe: Smart Disputes](https://docs.stripe.com/disputes/smart-disputes)
- [Stripe: Adds the ability to choose how you submit a dispute response(変更の記録、2025-09-30)](https://docs.stripe.com/changelog/clover/2025-09-30/dispute-submission-method)
- [Stripe: 料金体系 & 手数料](https://stripe.com/jp/pricing)
- [Stripe: How events work](https://docs.stripe.com/event-destinations)
- [Stripe: Makes thin events for API v1 resources generally available(変更の記録、2026-09-30)](https://docs.stripe.com/changelog/endive/2026-09-30/thin-events-for-api-v1-resources-generally-available)
- [Stripe: Charge SaaS fees to your connected accounts](https://docs.stripe.com/connect/integrate-billing-connect)
