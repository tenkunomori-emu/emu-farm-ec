-- 権限(GRANT)を書いていない表、シーケンス、関数が、データの口の立場から届かないことを確かめる。
-- supabase/config.toml の auto_expose_new_tables = false か、既定の権限を外すマイグレーションが
-- 外れると、このテストが通らなくなる。
begin;
select plan(10);

select is(current_user::text, 'postgres', 'テストは、マイグレーションと同じ postgres で動く');

create table public.privilege_check_table (id int);
create sequence public.privilege_check_sequence;
create function public.privilege_check_function() returns int language sql as 'select 1';

select ok(
  not has_table_privilege('anon', 'public.privilege_check_table', 'select, insert, update, delete'),
  '権限を書いていない表は、anon から届かない'
);
select ok(
  not has_table_privilege('authenticated', 'public.privilege_check_table', 'select, insert, update, delete'),
  '権限を書いていない表は、authenticated から届かない'
);
select ok(
  not has_table_privilege('service_role', 'public.privilege_check_table', 'select, insert, update, delete'),
  '権限を書いていない表は、service_role から届かない'
);

select ok(
  not has_sequence_privilege('anon', 'public.privilege_check_sequence', 'usage, select, update'),
  '権限を書いていないシーケンスは、anon から届かない'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.privilege_check_sequence', 'usage, select, update'),
  '権限を書いていないシーケンスは、authenticated から届かない'
);
select ok(
  not has_sequence_privilege('service_role', 'public.privilege_check_sequence', 'usage, select, update'),
  '権限を書いていないシーケンスは、service_role から届かない'
);

select ok(
  not has_function_privilege('anon', 'public.privilege_check_function()', 'execute'),
  '権限を書いていない関数は、anon から呼べない'
);
select ok(
  not has_function_privilege('authenticated', 'public.privilege_check_function()', 'execute'),
  '権限を書いていない関数は、authenticated から呼べない'
);
select ok(
  not has_function_privilege('service_role', 'public.privilege_check_function()', 'execute'),
  '権限を書いていない関数は、service_role から呼べない'
);

select * from finish();
rollback;
