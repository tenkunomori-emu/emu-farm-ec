-- setup.sql で作った表と関数を削除する。
-- Send Email Hook の設定をダッシュボードで削除してから実行する(先に関数を消すと、Auth のメールの処理が失敗するため)。

drop function if exists public.spike_send_email_hook(jsonb);
drop table if exists public.spike_email_hook_mode;
drop table if exists public.spike_email_hook_calls;
drop table if exists public.spike_rls_notes;
