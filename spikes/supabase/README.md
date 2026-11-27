# 方式検証のコード(Supabase)

設計が前提にしている Supabase の動作を、検証環境の Supabase のプロジェクトで確かめるコードです(基本設計書の TST-040)。本番のコードには使いません。確かめた結果は ADR に記録します。

| ファイル | 確かめること |
|---|---|
| `01-no-apikey.ts` | `apikey` ヘッダーのないリクエストを、Auth と Data API が拒否するか(AUTH-005) |
| `02-rls-user-token.ts` | パブリッシャブルキーと利用者のアクセストークンで Data API を呼ぶと、RLS がその利用者として働くか(AUTH-040) |
| `03-admin-create-user.ts` | 新規登録を無効にした状態で、管理用の API でアカウントを作れるか(AUTH-005、AUTH-020) |
| `04-send-email-hook.ts` | Send Email Hook に Postgres の関数を設定すると、Supabase Auth がメールを送らないか(AUTH-021) |
| `05-recreate-same-email.ts` | アカウントを削除した直後に、同じメールアドレスでアカウントを作れるか(AUTH-034、AUTH-035) |

## 決まり

- 検証のプロジェクト(`gpxqqrzpgcfqstvnxkxo`)だけで動かす。スクリプトは、ほかの URL では何もせずに止まる。
- シークレットキーは、確かめ用に新しく作り、確かめたあとに削除する。Vercel に置いたシークレットキーを、PC に写さないためである。
- `.env` はコミットしない(リポジトリの `.gitignore` で除いている)。
- 作ったアカウント、表、関数、Send Email Hook の設定は、確かめたあとに削除する。スクリプトは自動のテストではなく、人が動かす(TST-011)。
- 1つのファイルで1つのことを確かめ、何を確かめるかをファイルの冒頭に書く。

## 動かし方

### 準備

1. リポジトリのフォルダーで、検証のプロジェクトの設定の差分を表示し、結果を残しておく。後片付けのあとに、同じ結果になることを確かめる。

   ```
   npx supabase config diff --remote=gpxqqrzpgcfqstvnxkxo
   ```

2. Node.js 22.18 以上を使う(TypeScript のファイルを、ビルドせずにそのまま動かすため)。このフォルダーで `npm install` を実行する。
3. [API Keys](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/settings/api-keys) の画面で、シークレットキーを新しく作る(名前は `spike`)。
4. `.env.example` を `.env` にコピーし、値を入れる。
5. [SQL Editor](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/sql/new) で、次の文を実行し、結果を残しておく。Send Email hook を作ると、public のスキーマの権限が変わるため、後片付けのあとに比べる。

   ```
   select nspacl from pg_namespace where nspname = 'public';
   ```

6. [SQL Editor](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/sql/new) で、`setup.sql` を実行する。

### 確かめ

1. 次のスクリプトを、順に動かす。

   ```
   node --env-file=.env 01-no-apikey.ts
   node --env-file=.env 02-rls-user-token.ts
   node --env-file=.env 03-admin-create-user.ts
   node --env-file=.env 05-recreate-same-email.ts
   ```

2. Send Email Hook を、次の順に確かめる。Supabase Auth のメールの送信には、プロジェクト全体の上限がある(組み込みの送信では1時間に2通。Supabase の公式ドキュメント「Rate limits」)。before で1通、after で2通を頼むため、before のあと1時間あけてから after を動かす。
   1. `node --env-file=.env 04-send-email-hook.ts before` を動かし、`SPIKE_INBOX_EMAIL` の受信箱に、パスワードの再設定のメールが届くことを確かめる。
   2. [Auth Hooks](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/auth/hooks) の画面で、Send Email hook を追加する。種類は Postgres、スキーマは `public`、関数は `spike_send_email_hook` にする。画面を再読み込みし、一覧に Send Email hook が「ENABLED」で表示されることを確かめる。
   3. `node --env-file=.env 04-send-email-hook.ts after` を動かし、受信箱に新しいメールが届かないことを確かめる。before のメールが届くまでにかかった時間より長く待ってから確かめる。
   4. [Auth Hooks](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/auth/hooks) の画面で、Send Email hook を削除する。

### 後片付け

1. [SQL Editor](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/sql/new) で、`teardown.sql` を実行する。
2. [API Keys](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/settings/api-keys) の画面で、`spike` のシークレットキーを削除する。
3. [Users](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/auth/users) の画面で、確かめで作ったアカウント(`spike-` で始まるものと、`SPIKE_INBOX_EMAIL` のもの)が残っていないことを確かめる。
4. リポジトリのフォルダーで、準備の1と同じコマンドを実行し、結果が同じであることを確かめる。
5. [SQL Editor](https://supabase.com/dashboard/project/gpxqqrzpgcfqstvnxkxo/sql/new) で、準備の5と同じ文を実行し、結果が同じであることを確かめる。
