# ADR-0011: Supabase の認証をサイトのサーバーからだけ呼び、メールのリンクとログインの状態をサイトで持つ

- 日付: 2026-11-23
- ステータス: 採用

## 背景

- 会員と管理者のアカウント、パスワード、2段階認証の手段は、Supabase の認証に保存する(ADR-0010([0010-tech-stack-hosting-and-db-functions.md](0010-tech-stack-hosting-and-db-functions.md))、基本設計書([02-basic-design.md](../02-basic-design.md))の SYS-014)。
- Supabase の認証の初めの使い方は、ブラウザが公開してよい鍵を持ち、Supabase の認証を直接呼ぶ形である。この形では、パスワードの間違いを数えてログインを止めること(NFR-013)を、サイトで行えない。間違いを Supabase の認証の中で数える仕組みは、このサイトの Supabase では使えない(Supabase の公式ページ「Auth Hooks」)。
- Supabase の認証の口(登録、ログイン、パスワードの変更、2段階認証)は、インターネットに公開されている。鍵を持つ人は、サイトを通さずに呼べる。サイトを通さずに呼ばれると、ログインの制限を通らずにパスワードを試され、本人に知らせずにパスワードを変えられ、確認のリンクのないアカウントで、メールアドレスをふさがれる。
- 要件は、招待のリンクからパスワードを決めるまでアカウントを作らないこと(FR-003、FR-170)、前のリンクを使えなくすること(FR-202、FR-219、FR-249)、外された人がすぐに使えなくなること(FR-161、FR-174、FR-245、FR-246)を求めている。
- 2段階認証の2段階目には、本人が持つ端末での確認を求め、メールと SMS は使わない(NFR-001)。方式は、基本設計で決める。

## 検討した選択肢

### Supabase の認証の呼び方

| 選択肢 | 確かめた事実 | 判断 |
|---|---|---|
| ブラウザが公開してよい鍵を持ち、Supabase の認証を直接呼ぶ | 公開してよい鍵は、ブラウザに渡すことを前提にした鍵で、だれでも読める(Supabase の公式ページ「API keys」)。サイトを通さない呼び出しを止められない | 採らない |
| **Supabase の鍵をサイトのサーバーにだけ置き、サーバーから呼ぶ** | 鍵のない求めは、Supabase の窓口が通さない(Supabase の公式ページ「JWT Signing Keys」)。サーバーから秘密の鍵で呼び、利用者の IP アドレスを渡せば、Supabase の認証の、IP アドレスごとの回数の制限も、利用者ごとに効く(Supabase の公式ページ「Rate limits」) | **採用** |

### メールのリンク

| 選択肢 | 確かめた事実 | 判断 |
|---|---|---|
| Supabase の認証が作るリンク(登録の確認、招待、パスワードの再設定)を使う | 招待のリンクは、作った時点でアカウントができる(Supabase の公式ページ「generateLink」)。前のリンクを使えなくすることと、招待の取り消しには、サイトの記録が要る | 採らない |
| **6つの期限のあるリンクを、すべてサイトが作る** | 期限、一度だけ使えること、前のリンクを使えなくすることを、1つの仕組みで扱える(SYS-049) | **採用** |

### 2段階目の方式

| 選択肢 | 確かめた事実 | 判断 |
|---|---|---|
| **認証アプリが出す、時間で変わるコード** | Supabase の認証が、2段階目として備えている(Supabase の公式ページ「Multi-Factor Authentication」)。一般の無料のアプリを使える | **採用** |
| パスキー | Supabase の認証のパスキーは、実験的な機能で、API が予告なく変わることがある。パスワードの代わりにログインする方法であり、2段階目ではない(Supabase の公式ページ「Passkey authentication」) | 今は採らない |
| 電話に届くコード、メール | NFR-001 で使わないと決めている | 採らない |

### ログインの状態の確かめ方

| 選択肢 | 確かめた事実 | 判断 |
|---|---|---|
| Supabase の認証が出すアクセストークンだけを確かめる | ログアウトさせても、発行済みのアクセストークンは、期限まで有効である(Supabase の公式ページ「Signing out」) | 採らない。外された人が、期限まで使い続けられる |
| **ログインの状態をデータベースに記録し、求めのたびに確かめる** | 退会や、スタッフを外すことと同じ書き込みで、ログインの状態を終わらせられる(SYS-045) | **採用** |

## 決定

1. Supabase の認証とデータベースは、サイトのサーバーからだけ呼ぶ。Supabase の鍵は、公開してよい鍵も含めて、ブラウザに渡さず、Vercel の環境変数にだけ置き、旧来の鍵は無効にする。Supabase の認証は秘密の鍵で呼び、利用者の IP アドレスを渡す(基本設計書の AUTH-001、AUTH-005)。
2. 期限のあるメールのリンクは、6つとも、サイトが作り、確かめる。認証のメールは、すべてサイトの「知らせ」が送り、Supabase の認証には送らせない(AUTH-003、AUTH-014〜AUTH-021)。
3. 2段階目は、認証アプリが出す、時間で変わるコードで確かめる。パスキーは、正式な機能になり、2段階目として使えるようになったときに、手段の種類として足す(AUTH-022〜AUTH-025)。
4. ログインの状態は、データベースに記録し、求めのたびに、記録にあることと、今の役割を、データベースで確かめる(AUTH-029〜AUTH-033)。

## 影響とリスク

- Supabase の認証のクライアントの初めの使い方(ブラウザから直接呼ぶ形)を使わないため、登録、ログイン、2段階認証の画面と処理は、サイトで作る。
- 鍵が漏れたときは、その鍵を消して作り直す。漏れた鍵で呼ばれる間に備え、Supabase の認証の、新しい登録を受け付ける設定は切る(AUTH-005)。
- 実装のテストで確かめること: 鍵のない求めを、Supabase の認証とデータの口が通さないか。鍵を持たないブラウザから、サイトが出した URL で、写真を送り、見られるか(SYS-025)。鍵と一緒に利用者のアクセストークンを送ったとき、データベースの行ごとの決まりが、その利用者として効くか。新しい登録を受け付ける設定を切っても、管理用の操作でアカウントを作れるか。Supabase の認証のメールを、送り先を置き換える仕組み(Send Email Hook)で止められるか。Supabase の認証のアカウントを消したあと、同じメールアドレスで、すぐに新しいアカウントを作れるか。

## 合意の記録

議事録_2026_1122、議事録_2026_1123

## 参考にした情報

- [Supabase: API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase: Rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase: Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Supabase: Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase: Passkey authentication](https://supabase.com/docs/guides/auth/passkeys)
- [Supabase: Signing out](https://supabase.com/docs/guides/auth/signout)
- [Supabase: createSignedUploadUrl](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl)
