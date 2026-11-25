# 天空の森エミュー牧場 マーケットプレイス

生産者が出店し、購入者が生産者から直接買うマーケットプレイスです。決済には Stripe Connect のダイレクト支払いを使います。代金は購入者から各生産者の Stripe アカウントに直接入り、管理者はアプリケーション手数料だけを受け取ります。

> ステータス: **開発基盤の準備中**。要件定義書([01-requirements.md](docs/01-requirements.md))と基本設計書([02-basic-design.md](docs/02-basic-design.md))は確定済みです。現在は、実装に入る前の開発環境(Next.js のプロジェクト、ローカル環境の Supabase、CI)を整えています。各文書の版と状態は、下の「工程と成果物」の表を見てください。

## 工程と成果物

工程は、開発の進め方([CONTRIBUTING.md](CONTRIBUTING.md#工程とゲート))の「工程とゲート」の順に進めます。ゲートを満たすまで、次の工程には入りません。ただし、詳細設計と実装・単体テストは、機能ごとに進めます。

この表は、各文書の版と状態の正本です。文書の版か状態を変える PR では、この表の行も直します。

| 工程 | 成果物 | 状態 |
|---|---|---|
| 文書の地図 | 工程とゲート([CONTRIBUTING.md](CONTRIBUTING.md#工程とゲート)) | 確定 |
| 要件定義 | 要件定義書 v2.1([01-requirements.md](docs/01-requirements.md)) | 確定(タグ requirements-v2.1) |
| 基本設計 | 基本設計書 v1.0([02-basic-design.md](docs/02-basic-design.md))、ADR-0009〜ADR-0014、方式検証のコード([spikes/](spikes/))、要件から設計、テストへの対応表(トレーサビリティマトリクス)の最初の版([04-test.md](docs/04-test.md)。要件の ID と、基本設計の列) | 確定(タグ basic-design-v1.0) |
| 開発基盤の準備 | 設定ファイル、開発の進め方([CONTRIBUTING.md](CONTRIBUTING.md))の「開発環境の作り方」の節 | 作成中 |
| 詳細設計 | 機能ごとのマイグレーション、型、テスト | 未着手 |
| 実装・単体テスト | コード | 未着手 |
| テスト・品質確認 | テスト仕様書と結果、対応表のテストの列([04-test.md](docs/04-test.md)) | 未着手 |
| リリース・運用 | 運用設計書と操作手順書(05-operations.md) | 未着手 |

## 設計の判断(ADR)

工程をまたぐ技術の判断は、ADR に記録しています。[決定事項の記録](docs/decisions.md)は以前の記録で、今後は追記しません。

| ADR | 内容 |
|---|---|
| ADR-0001([0001-tech-stack.md](docs/adr/0001-tech-stack.md)) | 技術の選定(ADR-0010 で置き換え済み) |
| ADR-0002([0002-hosting-and-ownership.md](docs/adr/0002-hosting-and-ownership.md)) | ホスティングと引き渡し(ADR-0010 で置き換え済み) |
| ADR-0003([0003-ai-review.md](docs/adr/0003-ai-review.md)) | AI によるコードレビュー |
| ADR-0004([0004-stripe-connect-direct-charges.md](docs/adr/0004-stripe-connect-direct-charges.md)) | Stripe Connect のダイレクト支払い |
| ADR-0005([0005-stripe-account-holds-and-refunds.md](docs/adr/0005-stripe-account-holds-and-refunds.md)) | 生産者の Stripe アカウント、オーソリ(仮押さえ)と返金 |
| ADR-0006([0006-one-product-per-order.md](docs/adr/0006-one-product-per-order.md)) | 1回の注文は1つの商品 |
| ADR-0007([0007-ai-review-model.md](docs/adr/0007-ai-review-model.md)) | AI によるコードレビューのモデル |
| ADR-0008([0008-jcb-acceptance.md](docs/adr/0008-jcb-acceptance.md)) | JCB の受け付け |
| ADR-0009([0009-stripe-account-onboarding-and-spike-results.md](docs/adr/0009-stripe-account-onboarding-and-spike-results.md)) | 生産者の Stripe アカウントの登録、方式検証の結果 |
| ADR-0010([0010-tech-stack-hosting-and-db-functions.md](docs/adr/0010-tech-stack-hosting-and-db-functions.md)) | 技術の選定、本番環境のホスティング、データベース関数 |
| ADR-0011([0011-auth-server-side-and-site-links.md](docs/adr/0011-auth-server-side-and-site-links.md)) | 認証の処理(サーバー側)、メール内のリンク、2段階認証、セッション |
| ADR-0012([0012-checkout-session-and-external-services.md](docs/adr/0012-checkout-session-and-external-services.md)) | Checkout Session による購入手続き、Stripe の Webhook の処理、メール送信とアクセス解析のサービス |
| ADR-0013([0013-backup-recovery-and-scheduled-jobs.md](docs/adr/0013-backup-recovery-and-scheduled-jobs.md)) | バックアップと復旧、定期実行の処理と監視 |
| ADR-0014([0014-test-approach.md](docs/adr/0014-test-approach.md)) | テストの段階とツール、結合テストの方式 |

## 技術構成

| 領域 | 技術 | 状態 |
|---|---|---|
| Web フレームワーク | Next.js(App Router)、TypeScript | 決定(ADR-0010) |
| スタイリング | Tailwind CSS | 決定(ADR-0010) |
| データベース・認証・ストレージ | Supabase(PostgreSQL、Auth、RLS、Storage) | 決定(ADR-0010) |
| 決済 | Stripe Connect(ダイレクト支払い) | 決定(ADR-0010、ADR-0004、ADR-0005、ADR-0009) |
| ホスティング | Vercel(開発、検証、本番) | 決定(ADR-0010) |
| メール送信 | Resend | 決定(ADR-0012) |
| アクセス解析 | Vercel Web Analytics、Speed Insights | 決定(ADR-0012) |
| テスト | pgTAP、Vitest、Playwright | 決定(ADR-0014) |
| ソース管理・CI | GitHub(PR、Actions) | 導入中 |

システム構成図と、構成要素ごとの役割は、基本設計書([02-basic-design.md](docs/02-basic-design.md))の「システム構成と技術の分担」にあります。

## このリポジトリの目的

- マーケットプレイスを、**実際に運営する方々のために**作る。
- 要件定義、設計、技術判断、レビュー、テスト、運用までの開発の過程を、**公開して残す**。

## 進め方の原則

1. **ウォーターフォール型で進め、合意は議事録に残す**: 主催者は多忙なため、承認の手続きは設けません。毎日の会議で決めながら進め、合意は会議の議事録に記録します。
2. **規模に見合った設計**: 1つの Next.js のプロジェクトを、機能ごとに分けて整理します(モジュラーモノリス)。
3. **決めたことは記録する**: PR の説明の「合意の記録」に、合意または報告した議事録の名前を書きます。文書の版か状態を変えた場合は、その文書の改訂履歴にも書きます。技術判断の理由は、ADR(`docs/adr/`)に残します。手順は、開発の進め方([CONTRIBUTING.md](CONTRIBUTING.md#設計書の確定と合意の記録))にあります。
4. **変更はすべて PR で行う**: 変更の理由と、関係する議事録の名前を PR に残します。
5. **進み具合をいつでも見えるようにする**: [工程と成果物](#工程と成果物)の表を常に最新にし、作成中の文書は下書き(Draft)の PR で出します。

## 権利とライセンス

- 現時点では、**ライセンスを付けていません**。内容は閲覧できますが、再利用は許可していません(All rights reserved)。
- 牧場の名前、商品情報、写真、ロゴの権利は、牧場にあります。写真とロゴは、使用範囲が決まるまで、このリポジトリに含めません。
- コードのライセンスは、権利の取り決めとあわせて決めます。
