-- 確かめのスクリプトが使う表と関数を、検証のプロジェクトに一時的に作る。
-- Supabase のダッシュボードの SQL Editor で実行する。確かめたあと、teardown.sql で削除する。
-- 新しい表と関数には、既定の権限が付かない(supabase/migrations/20261125104318_default_privileges.sql)。
-- そのため、使う立場にだけ権限を付ける。

-- Supabase Auth は、supabase_auth_admin の立場で Hook の関数を呼ぶ(Supabase の公式ドキュメント「Auth Hooks」)。
-- public のスキーマの使用権限は、この SQL では付けない(後片付けで、元の状態に戻せなくなるため)。
-- 権限がないときは、何も作らずに止める。
do $$
begin
  if not has_schema_privilege('supabase_auth_admin', 'public', 'USAGE') then
    raise exception 'supabase_auth_admin に、public のスキーマの使用権限がありません';
  end if;
end;
$$;

-- 01、02: RLS を確かめる表。ログインした利用者は、自分の行だけを読める。
create table public.spike_rls_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  body text not null
);

alter table public.spike_rls_notes enable row level security;

create policy spike_rls_notes_select_own on public.spike_rls_notes
  for select to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.spike_rls_notes to authenticated;
grant select, insert, delete on public.spike_rls_notes to service_role;

-- 04: Send Email Hook に設定する関数と、関数が呼ばれた記録の表。
-- 2つの表は、RLS を有効にし、関数を呼ぶ supabase_auth_admin にだけポリシーを付ける
-- (Supabase の公式ドキュメント「Auth Hooks」)。anon と authenticated には権限を付けない。
create table public.spike_email_hook_calls (
  id uuid primary key default gen_random_uuid(),
  called_at timestamptz not null default now(),
  email_action_type text
);

-- fail が true のとき、関数はエラーを返す。
create table public.spike_email_hook_mode (
  id integer primary key check (id = 1),
  fail boolean not null
);

insert into public.spike_email_hook_mode (id, fail) values (1, false);

alter table public.spike_email_hook_calls enable row level security;
alter table public.spike_email_hook_mode enable row level security;

create policy spike_email_hook_calls_insert_auth_admin on public.spike_email_hook_calls
  for insert to supabase_auth_admin
  with check (true);

create policy spike_email_hook_mode_select_auth_admin on public.spike_email_hook_mode
  for select to supabase_auth_admin
  using (true);

create function public.spike_send_email_hook(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  insert into public.spike_email_hook_calls (email_action_type)
  values (event -> 'email_data' ->> 'email_action_type');

  if (select fail from public.spike_email_hook_mode where id = 1) then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 500, 'message', 'spike: send email hook error')
    );
  end if;

  -- メールを送らずに、成功を返す。
  return '{}'::jsonb;
end;
$$;

grant execute on function public.spike_send_email_hook(jsonb) to supabase_auth_admin;
grant insert on public.spike_email_hook_calls to supabase_auth_admin;
grant select on public.spike_email_hook_mode to supabase_auth_admin;

grant select on public.spike_email_hook_calls to service_role;
grant select, update on public.spike_email_hook_mode to service_role;
