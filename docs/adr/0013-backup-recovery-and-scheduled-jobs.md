# ADR-0013: データベースは同じプロジェクトに戻して Stripe から支払いを拾い直し、期限で動く処理は外の監視で見守る

- 日付: 2026-11-24
- ステータス: 採用
- 更新(2026-11-26): 基本設計書が「開発基盤の準備の工程で決める」とした3点(検証環境の構成、定期実行の設定方法、監視サービスの製品)を決めた。「検討した選択肢」に3つの表を追加し、「決定」の5、6、7と「影響とリスク」に追記した。「実装のテストで確かめること」から、公式ドキュメントで確認できた OPS-032 の項目を外した。
- 更新(2026-11-27): 主催者が受入テストで検証環境を開く方法を決めた(「影響とリスク」)。
- 更新(2026-11-27): 保護した環境への Webhook のリクエストの応答を、401 から 302 に直した(検証環境で確かめた結果。「検討した選択肢」と「影響とリスク」)。
- 更新(2026-11-28): 生産者のアカウントの一覧を読む操作と、復旧した注文の値(OPS-026)を、検証のサンドボックスで確かめた(Issue #221)。「確認できた事実(2026-11-28 の追加、Issue #221)」を足し、「影響とリスク」の「実装のテストで確かめること」から、この2つを外した。

## 背景

- 要件定義書([01-requirements.md](../01-requirements.md))は、データベースを直近7日のどの日の状態にも戻せること(NFR-020)、本番のデータベースを失ったときに24時間以内にサイトを戻すこと(NFR-021)、人の操作を待たずに動く処理が止まるか失敗したときに保守を担う開発者に知らせること(NFR-022)を求めている。
- NFR-020 の理由は、失った間の支払いを、突き合わせ(NFR-009)で見つけるとしている。しかし、基本設計書([02-basic-design.md](../02-basic-design.md))の定期の突き合わせ(IF-047)は、対象をサイトの記録から選ぶ。バックアップに戻すと、失った間の注文はサイトの記録から消え、Stripe には、仮押さえと代金が残る。今の突き合わせでは、購入者のカードの利用枠が押さえられたまま、または、代金が生産者に渡ったまま、注文がなくなる。
- 期限で動く処理のきっかけ(SYS-009)の仕組みと、メールを使わない知らせの道(IF-108)は、決まっていなかった。アプリは、自分が呼ばれなかったことを、自分では知らせられない。
- 開発、検証、本番の環境で、鍵とつなぐ先を分ける決まりが、基本設計書になかった。

## 検討した選択肢

### バックアップ

| 選択肢 | 判断 |
|---|---|
| **Supabase が毎日取るバックアップ(直近7日分)** | **採用**。NFR-020 の、直近7日と、目標復旧時点24時間に足りる(Supabase の公式ページ「Database Backups」) |
| 秒単位で戻せる追加の機能(Point-in-Time Recovery) | 今は採らない。失う間が、24時間から数分に縮む。事業が大きくなる途中で変えるものとして、Issue に残す |
| Supabase の外に、データベースの写しを持つ | 採らない。すべての個人情報を持つ場所が、もう1つ増え、その鍵と、消した情報がバックアップから7日で消えること(NFR-020)を、そこでも守る仕組みが要る。Supabase のプロジェクトそのものを消すと、バックアップも消える(同じページ)。この場合に戻せないことは、受け入れる(下の「影響とリスク」) |

### 戻す先

| 選択肢 | 判断 |
|---|---|
| **記録の一部が壊れたとき: 別のプロジェクトに戻して、壊れた記録だけを本番に写す** | **採用**。本番のデータベースを上書きしないため、写した記録のほかには、失う間は生じない |
| **全体を失ったとき: 同じプロジェクトに戻す** | **採用**。戻した時点よりあとの記録を失う(Supabase の公式ページ「Database Backups」)。ファイルの保存の中身、認証の設定、鍵は、そのまま残る |
| 全体を失ったとき: 別のプロジェクトに戻す(Restore to a new project) | 確かめと、同じプロジェクトに戻せないときに使う。有料の契約で、もとのプロジェクトが、データベースを丸ごと写す形のバックアップ(physical backups)を使っているときに使える。ファイルの保存の中身、認証の設定、鍵を写さない(Supabase の公式ページ「Restore to a new project」) |

### 失った間の支払い

| 選択肢 | 判断 |
|---|---|
| 定期の突き合わせ(IF-047)に任せる | 採らない。対象をサイトの記録から選ぶため、記録のない支払いを拾えない |
| **戻したあとに1回だけ、Stripe の側から支払いを読む、復旧の突き合わせを行う** | **採用**。Stripe の支払いの一覧は、作られた日時で絞れる(Stripe の公式ページ「List all PaymentIntents」)。明細、税率、アプリケーション手数料の額は、Checkout Session と支払いに残っている(公式ページ「The Checkout Session object」「Retrieve a Checkout Session's line items」) |

### 期限で動く処理のきっかけと、止まったときの知らせ

| 選択肢 | 判断 |
|---|---|
| **Vercel の、決まった時刻にアプリの入口を呼ぶ機能** | **採用**。アプリと同じ置き場所で動き(ADR-0010)、呼び出しに秘密の値を付けられる(Vercel の公式ページ「Managing Cron Jobs」) |
| **外部の監視のサービスに、処理を終えた合図と失敗の合図を送る** | **採用**。合図が来ないことで、きっかけが止まったことに、アプリの外から気づける。メールを送るサービスが止まっていても、メールでない手段で知らせられる |
| 保守を担う開発者へのメール(IF-097)だけで知らせる | 採らない。きっかけが止まったときと、メールを送るサービスが止まったときに、知らせが届かない |

ほかの仕組みで期限の処理を動かす形(データベースから定期にアプリを呼ぶ形など)は、比べていない。

### 検証環境の構成

検証環境は、だれでも開ける形にせず、Stripe のサンドボックスの Webhook を受ける、変わらない URL を持つ(OPS-012)。Deployment Protection を有効にした環境では、Stripe の Webhook のリクエストも 302(Vercel のログインの画面への転送)になり、受けられない。

| 選択肢 | 判断 |
|---|---|
| 本番と同じ Vercel プロジェクトに検証環境を置き、Protection Bypass for Automation のシークレットを Webhook の URL に付ける | 採用しない。このシークレットは、プロジェクトのすべてのデプロイで有効であり、Deployment Protection に加えて、Vercel のファイアウォールが通常はブロックするリクエストと、ボット対策のチャレンジも通過する(Vercel の公式ページ「Protection Bypass for Automation」)。Stripe の Webhook のために作るシークレットが、本番のサイトでも有効になる。本番のサイトに、保護を通過する手段を作らない(TST-010 の理由と同じ考え方) |
| 本番と同じ Vercel プロジェクトに検証環境を置き、Deployment Protection Exceptions に検証環境のドメインを登録する | 採用しない。ドメインの全体が公開され、OPS-012 を満たさない。Webhook のパスだけを保護の対象から外す設定はない |
| **検証環境を、本番と別の Vercel プロジェクトにする** | **採用**。シークレットの有効範囲が、検証のプロジェクトに限られる。環境変数も、プロジェクトの単位で分かれる(OPS-009) |

### 定期実行の設定方法

| 選択肢 | 判断 |
|---|---|
| **`vercel.json` の `crons`(Cron Jobs)** | **採用**。本番のデプロイだけで実行される(OPS-029)。Pro プランでは、指定した分に実行される(Vercel の公式ページ「Schedules」の比較表)。5分ごとの処理(OPS-030)に使える |
| Schedules | 採用しない。ベータである。実行の時刻が、1分から15分の幅でずれる(同じ表)。Cron Jobs はレガシーの機能とされ、今後 Schedules に移行される。移行は設定の書き換えだけで、ルートのコードは変わらない(Vercel の公式ページ「Migrating from Cron Jobs to Schedules」) |

### 監視サービスの製品

| 選択肢 | 判断 |
|---|---|
| **Healthchecks.io** | **採用**。OPS-044 の3つの要件を満たす。決めた時間内に ping が届かないと、チェックが Down になり、通知が送られる。`/fail` を付けた ping で、失敗を送れる。メール以外の通知先(Slack、SMS、電話など)を設定できる(Healthchecks.io の公式ページ「Documentation」「Configuring Notifications」)。通知は、チェックの状態が変わったときに送られ、Down の間に繰り返し通知するには、別の設定が要る(同じページ)。同じ失敗が続く間は通知を繰り返さない要件(OPS-048)を満たす。チェックは3つ(OPS-045)で足りる |
| Better Stack | 採用しない。OPS-044 の要件は満たす。必要なのは ping の監視だけであり、その機能に絞った Healthchecks.io で足りる |

## 決定

1. バックアップは、Supabase が毎日取るバックアップを使い、Supabase の外に写しは持たない(OPS-014、OPS-017)。
2. 記録の一部が壊れたときは、本番のデータベースを上書きせず、別のプロジェクトに戻して、壊れた記録だけを本番に写す。全体を失ったときは、同じプロジェクトに戻す。別のプロジェクトを本番の代わりに使うときに作り直すものを、基本設計書に表にした。Supabase の設定は、リポジトリに置いた設定から作り直せるようにする(OPS-015、OPS-016)。
3. 同じプロジェクトに戻すときは、戻す操作の前から、戻したあとの処理が終わるまで、サイトをメンテナンス中にする。戻したあと、すべてのログインの状態を終わらせ、復旧の突き合わせと、定期の突き合わせを1回行ってから、メンテナンス中を解く(OPS-018〜OPS-021)。
4. 復旧の突き合わせは、支払いに付けた、購入手続きを見分ける ID の注文が、サイトの記録にない支払いを扱う。確定していなければ、仮押さえを取り消して、購入者と生産者に知らせ(TRN-003)、確定していれば、Stripe から読んだ値と、その支払いの返金、不審請求で、復旧した注文を作る(TRN-062、OPS-020、OPS-022〜OPS-026)。このため、支払いに、購入手続きを見分ける ID に加えて、商品の ID を付ける(SYS-012、IF-021)。
5. 開発、検証、本番で、Stripe、Supabase、メールを送るサービスの鍵を分ける。本番でない環境に Stripe の本番の鍵が置かれているときは、アプリは Stripe を呼ばない。本番の記録を、開発と検証の環境に写さない(OPS-006〜OPS-013)。検証環境は、本番と別の Vercel プロジェクトにする。検証のプロジェクトの Deployment Protection は、All Deployments を対象にし、Vercel Authentication を使う。本番のプロジェクトの Deployment Protection は、サイトを公開するまでは All Deployments を対象にし、公開するときに、本番のドメインを除いて、すべてのデプロイを保護する設定(Standard Protection)に変える。検証のプロジェクトでは、Stripe の Webhook は、Protection Bypass for Automation のシークレットを、Webhook の URL のクエリパラメーターに付けて受ける。このシークレットは、Stripe の Webhook の URL にだけ使い、テストには渡さない(TST-010)。検証のプロジェクトでは、Cron Jobs を無効にする。別のプロジェクトでは、`VERCEL_ENV` が検証環境でも `production` になるため、環境の判別には使わず、サイトの環境変数(`APP_ENV`)で判別する。`APP_ENV` が設定されていないとき、または決めた値でないときは、アプリは Stripe を呼ばない(OPS-010)。
6. 期限で動く処理は、5分ごと、1時間ごと、1日1回の3つの間隔で、本番だけで動かす(OPS-029〜OPS-043)。`vercel.json` の `crons`(Cron Jobs)で設定する。Schedules は採用しない。
7. 外部の監視のサービスを1つ使い、処理を終えた合図と失敗の合図を送る。製品は、Healthchecks.io にする。アカウントの作成、チェックと通知先の設定は、リリース・運用の工程で行う(OPS-044〜OPS-049)。

## 確認できた事実(2026-11-28 の追加、Issue #221)

検証のサンドボックスで、確かめ用の生産者のアカウントを使った(ADR-0009 の「確認できた事実(2026-11-28 の追加、Issue #221)」)。方式検証のコードは、[spikes/stripe/](../../spikes/stripe/) の 14-order-recovery-values.ts、15-accounts-list.ts、embedded/order-recovery-server.ts である。使った API の版は 2026-11-18.endive、stripe のライブラリは 23.2.0 である。

| 確かめたこと | 結果 |
|---|---|
| Accounts v2 の一覧の API で、生産者のアカウントの一覧を読む | 読めた。次のページは、返事の next_page_url(ページのトークンが付いている)で読む。一覧の API には include の指定がなく、一覧の結果の configuration と requirements は null だった。カード決済の状態と足りない項目は、アカウントを1件ずつ読んで確かめる(OPS-041 は、サイトの記録から選んだ生産者のアカウントを、1件ずつ読む) |
| 復旧の突き合わせで、Checkout Session と支払いから、OPS-026 の値を読む | 組み込む形の Checkout Session で仮押さえをし、代金を確定したあと、すべて読めた。読むところは、次の表のとおりである |

| OPS-026 の値 | 読むところ |
|---|---|
| 購入手続きを見分ける ID と商品の ID(SYS-012) | Checkout Session と支払いの metadata(両方に付けた) |
| 商品の名前、数量、価格、商品の小計、送料 | Checkout Session の明細。送料は、明細の1行にした |
| 消費税の税率 | 明細の taxes。明細を読むときに、data.taxes を展開する(expand)必要がある |
| 支払いの総額 | Checkout Session の amount_total(支払いの額と同じ) |
| アプリケーション手数料の額 | 支払いと Charge の application_fee_amount |
| 決済手数料(Stripe の手数料とその消費税) | Charge の残高の取引の fee_details の、stripe_fee と tax の合計。残高の取引の fee には、アプリケーション手数料も入るため、fee をそのまま使わない(3,260円の支払いで、fee は453円で、アプリケーション手数料324円、stripe_fee 117円、tax 12円の合計だった) |
| 購入者のメールアドレス | Checkout Session の customer_details.email(Charge の billing_details.email にも入る。customer_email と receipt_email は空だった) |
| 代金を確定した日時 | Charge には、この日時の項目がない。代金を確定すると作られる残高の取引の作成日時(created)が、確定の操作と同じ秒だった |

閉じた連結アカウントは、closed を指定しない限り、一覧に含まれない(stripe のライブラリの型の説明。動かしては確かめていない)。

## 影響とリスク

- 失う間は、いちばん新しいバックアップに戻したときで、最大で24時間と、戻す操作にかかる時間である。古いバックアップに戻したときは、最大で7日と、戻す操作にかかる時間である(OPS-014)。失った間の、サイトだけが持つ記録(商品の変更、メッセージ、返金の申し出、「発送を知らせる」、会員の登録と退会、管理者の操作など)は、戻らない。目標復旧時点(NFR-020)の範囲として、受け入れる。利用者に、失った間の日時を示し、やり直してもらう(OPS-028)。
- 同じプロジェクトに全体を戻したときは、失った間に退会した会員と生産者が、退会の前の状態に戻る。退会した生産者の商品は、また出品され、退会した会員のアカウント、メールアドレス、送り先の住所は、また残る(FR-161、FR-163、FR-165、NFR-008)。目標復旧時点(NFR-020)の範囲として、受け入れる。戻したあとに、オーナーと保守を担う開発者が確かめて、やり直す対応は、運用設計書に書く。
- 復旧した注文には、送り先の氏名、住所、電話番号がない。送り先は、Stripe に渡していないためである(IF-001)。発送の前であれば、購入者と生産者が、注文ごとのメッセージで送り先を伝え合うか、生産者が返金する(OPS-026)。
- 失った間に登録した商品(失った間に登録した生産者の商品を含む)の支払いのうち、仮押さえに成功したか、代金を確定した支払いは、サイトに商品の記録がなく、購入手続きも注文も作り直せない。直せないずれとして、保守を担う開発者に知らせ、保守を担う開発者が扱う(OPS-025)。
- Supabase のプロジェクトそのものを消すと、バックアップも消え、戻せない。プロジェクトを消せる権限を持つ人を、限る。
- 実装のテストで確かめること:
  - 本番でない環境に、Stripe の本番の鍵を置いたときに、アプリが Stripe を呼ばないこと(OPS-010)。
  - 変換した商品の写真が、Vercel の側にいつまで残るか(OPS-002、OPS-004)。
- Cron Jobs は、実行が抜けることと、重複することがあり、失敗した実行は再実行されない(Vercel の公式ページ「Managing Cron Jobs」)。OPS-032 の前提を、公式ドキュメントで確認した。
- 本番のプロジェクトは、サイトを公開するまで、Deployment Protection の対象を All Deployments にする。この間に、Cron Jobs のリクエストが届くかは、公式ドキュメントに記載がない。本番環境を作るときに確認する。この間は、Stripe の本番の Webhook のリクエストも 302(Vercel のログインの画面への転送)になり、受けられない(本番のプロジェクトには、シークレットを置かない)。Stripe の本番の鍵と Webhook の送信先は、保護の設定を Standard Protection に変えたあとに設定する。
- 検証のプロジェクトのシークレットは、Webhook のパスだけでなく、検証のプロジェクトのすべてのデプロイの保護を通過できる。シークレットは、Stripe のサンドボックスの Webhook の URL に含まれる。検証用のサンドボックスを開ける人を、検証環境を開いてよい人に限る。検証環境には、本番の記録を置かない(OPS-013)。漏れたときは、シークレットを作り直す。
- Vercel Authentication で保護した検証環境を開けるのは、アクセスを許可された Vercel のユーザーと、Shareable Link を受け取った人である(Vercel の公式ページ「Restrict access to deployments with Vercel Authentication」)。主催者は、受入テストで、開発者が発行した Shareable Link から検証環境を開く。リンクは、受入テストの期間だけ有効にし、終わったら取り消す。検証環境には本番のデータを置かないため(OPS-013)、リンクを知っている人が開けることは許容する。
- Healthchecks.io が、復旧したときに通知するか(OPS-048)は、公式ドキュメントに明記がない。監視を設定するときに、本番環境で確認する。
- Healthchecks.io の ping の URL は、シークレットとして扱う(公式ページ「Documentation」)。本番の Vercel プロジェクトの環境変数にだけ置く(SYS-002、OPS-044)。
- リリースの前に確かめること: 同じプロジェクトにバックアップを戻すのにかかる時間と、運用設計書の手順で、別のプロジェクトにサイトを戻し、24時間以内に終わること(NFR-020、NFR-021 の検証方法)。
- 事業が大きくなる途中で変えるもの(Issue に残す): 秒単位で戻せる追加の機能。Supabase の外の写し。

## 合意の記録

議事録_2026_1124、議事録_2026_1126、議事録_2026_1128

## 参考にした情報

- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase: Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Supabase: Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Stripe: List all PaymentIntents](https://docs.stripe.com/api/payment_intents/list)
- [Stripe: The Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object)
- [Stripe: Retrieve a Checkout Session's line items](https://docs.stripe.com/api/checkout/sessions/line_items)
- [Stripe: API keys](https://docs.stripe.com/keys)
- [Vercel: Managing Cron Jobs](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)
- [Vercel: Image Optimization](https://vercel.com/docs/image-optimization)
- [Vercel: Managing environment variables across environments](https://vercel.com/docs/environment-variables/manage-across-environments)
- [Vercel: Deployment Protection on Vercel](https://vercel.com/docs/deployment-protection)
- [Vercel: Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
- [Vercel: Bypass Deployment Protection for testing, sharing, and automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection)
- [Vercel: Restrict access to deployments with Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [Vercel: Schedules](https://vercel.com/docs/schedules)
- [Vercel: Migrating from Cron Jobs to Schedules](https://vercel.com/docs/schedules/migrate-from-cron-jobs)
- [Healthchecks.io: Documentation](https://healthchecks.io/docs/)
- [Healthchecks.io: Configuring Notifications](https://healthchecks.io/docs/configuring_notifications/)
- [Stripe: List accounts(Accounts v2)](https://docs.stripe.com/api/v2/core/accounts/list)
