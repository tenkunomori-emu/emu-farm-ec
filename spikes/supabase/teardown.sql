-- setup.sql で作った表と関数を削除する。
-- Send Email Hook の設定をダッシュボードで削除してから実行する(先に関数を消すと、Auth のメールの処理が失敗するため)。

drop function if exists public.spike_send_email_hook(jsonb);
drop table if exists public.spike_email_hook_mode;
drop table if exists public.spike_email_hook_calls;
drop table if exists public.spike_rls_notes;

-- Auth Hooks の画面で Hook を作ると、public のスキーマの使用権限が supabase_auth_admin に付く。
-- 準備で記録した値に戻すため、外す。外したあとも、すべてのロールに付いた使用権限で使える。
revoke usage on schema public from supabase_auth_admin;
