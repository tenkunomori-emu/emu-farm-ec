# 天空の森エミュー牧場 マーケットプレイス

生産者が出店し、購入者が生産者から直接買うマーケットプレイスです。代金は、購入者から各生産者の Stripe のアカウントに直接入り、管理者はアプリケーション手数料だけを受け取ります。

> ステータス: **作り直し中**。要件定義書([01-requirements.md](docs/01-requirements.md))は、マーケットプレイスの要件定義書として確定し、基本設計で決めたことに合わせて直した版も確定しました。基本設計書(02-basic-design.md)も、確定した要件定義書をもとに書き直し、確定しました。実装は未着手です。各文書の版と状態は、下の「工程と成果物」の表のとおりです。

## 工程と成果物

このリポジトリの文書の目次です。工程は、開発の進め方([CONTRIBUTING.md](CONTRIBUTING.md#工程とゲート))の「工程とゲート」の順に進め、ゲートを満たすまで次の工程に入りません(詳細設計と実装・単体テストは、機能ごとに進めます)。この表は、各文書の版と状態の正本です。文書の版か状態を変える PR で、その文書の行も直します。

| 工程 | 成果物 | 状態 |
|---|---|---|
| 文書の地図 | 工程とゲート([CONTRIBUTING.md](CONTRIBUTING.md#工程とゲート)) | 確定 |
| 要件定義 | 要件定義書 v2.1([01-requirements.md](docs/01-requirements.md)) | 確定(タグ requirements-v2.1) |
| 基本設計 | 基本設計書 v1.0([02-basic-design.md](docs/02-basic-design.md))、方式検証のコード(spikes/)、要件から設計、テストへの対応表の最初の版(04-test.md。要件の ID と、基本設計の列) | 確定(タグ basic-design-v1.0)。基本設計書に、「システム構成と技術の分担」、「状態遷移と、決済と送金の流れ」、「論理データ」、「認証と認可」、「外部連携と知らせ」、「画面一覧と画面遷移」、「非機能と運用の方式」、「結合テストの方針」を書いた。技術の選定と、本番の置き場所を、ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))に記録した。認証の方式を、ADR-0011([0011-auth-server-side-and-site-links.md](docs/adr/0011-auth-server-side-and-site-links.md))に記録した。購入手続きの方式と、Stripe の知らせの扱いを、ADR-0012([0012-checkout-session-and-external-services.md](docs/adr/0012-checkout-session-and-external-services.md))に記録した。バックアップと復旧の方式と、期限で動く処理の見守り方を、ADR-0013([0013-backup-recovery-and-scheduled-jobs.md](docs/adr/0013-backup-recovery-and-scheduled-jobs.md))に記録した。結合テストの方式を、ADR-0014([0014-test-approach.md](docs/adr/0014-test-approach.md))に記録した。方式検証のコード(spikes/stripe/)で、お金の流れの前提を確かめ、結果を ADR-0009([0009-stripe-account-onboarding-and-spike-results.md](docs/adr/0009-stripe-account-onboarding-and-spike-results.md))と ADR-0012 に記録した。対応表([04-test.md](docs/04-test.md))は、MVP のすべての要件を並べ、基本設計の列を埋めた |
| 開発基盤の準備 | 設定ファイル、開発の進め方([CONTRIBUTING.md](CONTRIBUTING.md))に足す「開発環境の作り方」の節 | 未着手 |
| 詳細設計 | 機能ごとのマイグレーション、型、テスト | 未着手 |
| 実装・単体テスト | コード | 未着手 |
| テスト・品質確認 | テスト仕様書と結果、対応表のテストの列(04-test.md) | 未着手 |
| リリース・運用 | 運用設計書と操作手順書(05-operations.md) | 未着手 |

工程をまたぐ技術の判断は、ADR に残しています: ADR-0001([0001-tech-stack.md](docs/adr/0001-tech-stack.md))(技術の選定。ADR-0010 で置き換え済み)、ADR-0002([0002-hosting-and-ownership.md](docs/adr/0002-hosting-and-ownership.md))(ホスティングと引き渡し。ADR-0010 で置き換え済み)、ADR-0003([0003-ai-review.md](docs/adr/0003-ai-review.md))(AI のレビュー)、ADR-0004([0004-stripe-connect-direct-charges.md](docs/adr/0004-stripe-connect-direct-charges.md))(ダイレクト支払い)、ADR-0005([0005-stripe-account-holds-and-refunds.md](docs/adr/0005-stripe-account-holds-and-refunds.md))(生産者のアカウント、仮押さえと返金)、ADR-0006([0006-one-product-per-order.md](docs/adr/0006-one-product-per-order.md))(1回の注文は1つの商品)、ADR-0007([0007-ai-review-model.md](docs/adr/0007-ai-review-model.md))(AI のレビューのモデル)、ADR-0008([0008-jcb-acceptance.md](docs/adr/0008-jcb-acceptance.md))(JCB の受け付け)、ADR-0009([0009-stripe-account-onboarding-and-spike-results.md](docs/adr/0009-stripe-account-onboarding-and-spike-results.md))(生産者のアカウントと登録、方式検証の結果)、ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))(技術の選定、本番の置き場所、データベースの関数)、ADR-0011([0011-auth-server-side-and-site-links.md](docs/adr/0011-auth-server-side-and-site-links.md))(認証の呼び方、メールのリンク、2段階目の方式、ログインの状態)、ADR-0012([0012-checkout-session-and-external-services.md](docs/adr/0012-checkout-session-and-external-services.md))(購入手続きの方式、Stripe の知らせの扱い、メールを送るサービスとアクセス解析)、ADR-0013([0013-backup-recovery-and-scheduled-jobs.md](docs/adr/0013-backup-recovery-and-scheduled-jobs.md))(バックアップと復旧、期限で動く処理と監視)、ADR-0014([0014-test-approach.md](docs/adr/0014-test-approach.md))(テストの段と道具、結合テストのつなぎ方)。[決定事項の記録](docs/decisions.md)は過去の記録で、今後は書き加えません。

## 技術構成

| 領域 | 技術 | 状態 |
|---|---|---|
| アプリケーション | Next.js(App Router)、TypeScript | 決定(ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))) |
| 画面の見た目 | Tailwind CSS | 決定(ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))) |
| データベース・認証・ファイルの保存 | Supabase(PostgreSQL、認証、行レベルセキュリティ、ファイルの保存) | 決定(ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))) |
| 決済 | Stripe(Connect のダイレクト支払い) | 決定(ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))、ADR-0004([0004-stripe-connect-direct-charges.md](docs/adr/0004-stripe-connect-direct-charges.md))、ADR-0005([0005-stripe-account-holds-and-refunds.md](docs/adr/0005-stripe-account-holds-and-refunds.md))、ADR-0009([0009-stripe-account-onboarding-and-spike-results.md](docs/adr/0009-stripe-account-onboarding-and-spike-results.md))) |
| ホスティング | Vercel(開発、検証、本番) | 決定(ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md))) |
| メールの送信 | Resend | 決定(ADR-0012([0012-checkout-session-and-external-services.md](docs/adr/0012-checkout-session-and-external-services.md))) |
| アクセス解析 | Vercel の Web Analytics と Speed Insights | 決定(ADR-0012([0012-checkout-session-and-external-services.md](docs/adr/0012-checkout-session-and-external-services.md))) |
| ソース管理・自動チェック | GitHub(PR、Actions) | 予定 |
| テスト | 型チェック、単体テスト、E2Eテスト | 予定(品質目標は、要件定義書([01-requirements.md](docs/01-requirements.md))の非機能の要件) |

## 構成図

システムの構成図と、構成要素ごとの受け持ちは、基本設計書([02-basic-design.md](docs/02-basic-design.md))の「システム構成と技術の分担」にあります。

## このリポジトリの目的

- マーケットプレイスを、**実際に運営する方々のために**作る。
- 開発の過程(要件定義、設計、技術判断、レビュー、テスト、運用)を、**公開して残す**。

## 進め方の原則

1. **工程はウォーターフォール型、合意は議事録で**: 主催者は多忙なため、承認の手続きは設けない。工程と成果物はウォーターフォール型で進め、合意と承認に関しては、会議の議事録で記録する。毎日の会議で決めながら進めることで、主催者の時間を使わずに、手戻りを防ぐ。
2. **規模に見合った設計**: 1つのアプリを機能別に整理する(モジュラーモノリス)。
3. **決めたことは記録する**: 会議で合意したことと、議事録で報告したことは、そのPRの説明文にある「合意の記録」の欄に、議事録の名前を書く。そのPRで文書の版か状態を変えた場合は、その文書の改訂履歴にも、議事録の名前を書く。技術判断の理由は、`docs/adr/` に残す。手順は、開発の進め方([CONTRIBUTING.md](CONTRIBUTING.md#設計書の確定と合意の記録))に書いている。
4. **変更はPR経由**: 変更の理由と、合意または報告した議事録の名前を、PRに残す。
5. **進み具合をいつでも見えるようにする**: [工程と成果物](#工程と成果物)の状態を常に最新にし、作成中の文書は下書きのPRとして出す。

## 権利とライセンス

- 現時点では、**ライセンスを付けていません**。このリポジトリの内容は、閲覧できますが、再利用の許可は出していません(All rights reserved)。
- 牧場の名前、商品情報、写真、ロゴの権利は、牧場にあります。写真とロゴは、使用範囲が決まるまで、このリポジトリに含めません。
- コードのライセンスは、権利の取り決めとあわせて、あとで決めます。
