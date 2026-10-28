# データ設計(マルチ生産者対応の基礎)

最終更新: 2026-10-28 / 版: v0.1 / ステータス: 作成中

### 改訂履歴

| 版 | 状態 | 内容 | 合意の記録 |
|---|---|---|---|
| v0.1 | 作成中 | 版を付けた。「未決事項」に DQ- の ID を付けた | なし(作成中のため) |

## 方針

- フェーズ1〜3は**牧場だけ**で販売。ただしデータは最初から**複数の生産者が参加できる形**にする。
- 牧場は「生産者の1件目」として登録する。単独店舗用の特別な構造は作らない。
- 後から生産者を追加しても、**テーブルの作り直しやデータ移行が不要**であることをゴールにする。
- 金額は**円の整数**で保持する(小数・浮動小数を使わない)。

## 概念モデル

```
producers(生産者) 1 ── n products(商品) 1 ── n product_variants(規格・価格・在庫)
orders(注文) 1 ── n fulfillments(生産者ごとの出荷単位) 1 ── n order_items(明細)
profiles(会員) n ── n producers (producer_members: 役割付き)
inquiries(問い合わせ) / events(イベント) / subscribers(メール・LINE登録)
```

ポイントは、**注文(お客様単位)と出荷(生産者単位)を分ける**こと。
いまは1件の注文に出荷が1つ(牧場)だけだが、将来、1回の購入に複数の生産者の商品が入っても、出荷は生産者ごとに別々に扱える。

## テーブル案(抜粋)

```sql
-- 生産者(牧場は1件目)
create table producers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  story text,                      -- 紹介文
  stripe_account_id text,          -- フェーズ4(Stripe Connect)用。当面はnull
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 商品
create table products (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references producers(id),
  category text not null,          -- 例: cosmetic / food / goods / experience
  name text not null,
  description text,
  tax_rate_percent int not null,   -- 8 or 10 等。要確認(税理士)
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 規格・価格・在庫
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  label text not null,             -- 例: 5g
  price_yen int not null check (price_yen >= 0),
  stock int not null default 0 check (stock >= 0)
);

-- 注文(お客様単位)
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  status text not null,            -- pending / paid / cancelled ...
  stripe_payment_intent_id text,
  total_yen int not null,
  created_at timestamptz not null default now()
);

-- 出荷単位(生産者ごと)
create table fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  producer_id uuid not null references producers(id),
  shipping_fee_yen int not null default 0,
  status text not null,            -- preparing / shipped ...
  tracking_number text
);

-- 明細
create table order_items (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references fulfillments(id),
  variant_id uuid not null references product_variants(id),
  quantity int not null check (quantity > 0),
  unit_price_yen int not null      -- 購入時点の価格を保存
);

-- 生産者に所属するメンバーと役割
create table producer_members (
  producer_id uuid references producers(id),
  user_id uuid references auth.users(id),
  role text not null,              -- owner / staff
  primary key (producer_id, user_id)
);
```

これは設計の骨子であり、実装時にマイグレーションとして精査する。

## 権限(RLS)の考え方

- 公開商品(`is_published = true`)は誰でも閲覧できる。
- 生産者メンバーは、**自分の生産者に紐づく**商品・出荷・明細だけを読み書きできる。
- 全体の管理者(サイト運営)は全件を扱える。
- 注文者(お客様)は自分の注文だけを読める。
- 権限チェックを**アプリのコードだけに頼らず、DB側(RLS)でも保証**する。マルチ生産者化の核心で、誤って他の生産者のデータが見えることを構造的に防ぐ。

## 将来の拡張ポイント

| 将来の要望 | 追加・変更 | 既存設計への影響 |
|---|---|---|
| 他の生産者が参加 | `producers`に行を追加、メンバーを招待 | なし |
| 生産者別の送料 | `fulfillments.shipping_fee_yen`の算出ロジック追加 | 小 |
| 売上の分配 | `stripe_account_id`を使いStripe Connectを導入 | 決済フローの変更のみ |
| 手数料 | 手数料率の項目追加 | 小 |
| 体験予約 | 商品カテゴリに`experience`+枠テーブル | 追加のみ |

## 未決事項

- DQ-01: 在庫の引当タイミング(カート追加時/決済確定時)
- DQ-02: 注文キャンセル・返金時の在庫戻し
- DQ-03: 会員(応援会員)と注文者の統合

購入手続きの画面(Stripe の Checkout か Elements か)は、基本設計書 v0.1([03-basic-design.md](03-basic-design.md))の BQ-02(購入手続きの画面)で扱う。
