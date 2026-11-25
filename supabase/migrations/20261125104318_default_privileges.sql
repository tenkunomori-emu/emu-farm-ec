-- 新しい表、ビュー、シーケンス、関数に、既定で付く権限を外す。
-- データの口(anon、authenticated、service_role)は、鍵があれば、サイトを通さずに呼べる
-- (基本設計書の AUTH-005)。権限は、作るマイグレーションで、使う立場にだけ付ける。
-- 検証と本番のプロジェクトの設定がどちらでも、同じ結果にするため、マイグレーションで外す。

-- 関数は、PostgreSQL の既定で、すべての立場(PUBLIC)に実行の権限が付く。
-- スキーマを指定した形では外せないため、指定せずに外す。
alter default privileges for role postgres
  revoke execute on functions from public;

-- Supabase が、public のスキーマで、データの口の立場に直接付ける既定の権限を外す。
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
