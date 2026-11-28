-- 会員の登録の申し込みと確認(Issue #227)で使う表と関数。
-- 会員(ENT-001)、期限のあるリンク(ENT-003)、送った知らせ(ENT-023)を作る。
-- この3つの表は、ログインしている人がいない処理(登録、メールのリンクの処理、期限で動く処理)だけが、
-- 管理用の鍵(service_role)で使う(基本設計書の AUTH-041)。anon と authenticated には、権限を付けない。
-- 会員が自分の行を読む決まりは、ログインの状態(ENT-030)と一緒に足す(AUTH-040)。

-- 会員(ENT-001)。メールアドレスとパスワードは、Supabase の認証が持つ(SYS-014)。
create table public.members (
  id uuid primary key default gen_random_uuid(),
  -- 退会したあと、Supabase の認証のアカウントを消すと、空になる(AUTH-034)。
  auth_user_id uuid unique references auth.users (id) on delete set null,
  -- 購入者向けの利用規約とプライバシーポリシーに同意した日時(FR-212)。登録を申し込んだ日時である。
  terms_agreed_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  -- Supabase の認証のアカウントを指していない会員は、退会した会員だけである。
  constraint members_auth_user_check check (auth_user_id is not null or withdrawn_at is not null)
);

alter table public.members enable row level security;
grant select, insert, update on public.members to service_role;

-- 期限のあるリンク(ENT-003)。用途は、使う Issue のマイグレーションで足す。
create table public.expiring_links (
  id uuid primary key,
  purpose text not null
    constraint expiring_links_purpose_check check (purpose in ('registration_confirmation')),
  -- 指す先。登録の確認では、確認を待っている申し込みの、Supabase の認証のアカウント。
  -- アカウントを消すと、リンクも消える(AUTH-019)。
  auth_user_id uuid references auth.users (id) on delete cascade,
  -- リンクの値から求めた、元に戻せない値(AUTH-015)。リンクの値は、サーバーだけが持つ秘密の値と、
  -- この行の id から作る。データベースは、リンクの値を持たない。
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint expiring_links_target_check
    check (purpose <> 'registration_confirmation' or auth_user_id is not null),
  constraint expiring_links_expires_at_check check (expires_at > created_at)
);

-- 使える状態のリンクは、同じ用途と同じ指す先で、1つだけにする(AUTH-018)。
create unique index expiring_links_one_usable_idx
  on public.expiring_links (purpose, auth_user_id)
  where used_at is null and revoked_at is null;

alter table public.expiring_links enable row level security;
grant select, insert, update, delete on public.expiring_links to service_role;

-- 送った知らせ(ENT-023)。宛先のメールアドレスは持たず、送るときに宛先が指す記録から読む(IF-057)。
-- id は、メールを送るサービスに渡す、二重に送らないための鍵にも使う(IF-105)。
-- 種類と宛先は、使う Issue のマイグレーションで足す。
create table public.sent_notifications (
  id uuid primary key,
  kind text not null
    constraint sent_notifications_kind_check
    check (kind in ('registration_confirmation', 'already_registered')),
  recipient_member_id uuid references public.members (id),
  -- 申し込みが消えると、リンクと一緒に消える(AUTH-019)。
  recipient_link_id uuid references public.expiring_links (id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint sent_notifications_recipient_check
    check (num_nonnulls(recipient_member_id, recipient_link_id) = 1),
  constraint sent_notifications_kind_recipient_check check (
    (kind = 'registration_confirmation' and recipient_link_id is not null)
    or (kind = 'already_registered' and recipient_member_id is not null)
  )
);

create index sent_notifications_unsent_idx
  on public.sent_notifications (created_at)
  where sent_at is null;

alter table public.sent_notifications enable row level security;
grant select, insert, update on public.sent_notifications to service_role;

-- 登録の申し込みを記録する。リンクと、登録の確認の知らせを、同じ書き込みで作る(SYS-022、IF-105)。
-- Supabase の認証のアカウントは、呼ぶ前に、Next.js のアプリが作る(AUTH-019、AUTH-020)。
create function public.account_record_registration(
  p_auth_user_id uuid,
  p_link_id uuid,
  p_token_hash bytea,
  p_expires_at timestamptz,
  p_notification_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.expiring_links (id, purpose, auth_user_id, token_hash, expires_at)
  values (p_link_id, 'registration_confirmation', p_auth_user_id, p_token_hash, p_expires_at);

  insert into public.sent_notifications (id, kind, recipient_link_id)
  values (p_notification_id, 'registration_confirmation', p_link_id);
$$;

grant execute on function public.account_record_registration(uuid, uuid, bytea, timestamptz, uuid)
  to service_role;

-- 登録の確認のリンクで、会員にする(FR-141、AUTH-017)。「登録を完了する」が押されたときに呼ぶ。
-- 返す値: confirmed(会員にした)、already_confirmed(すでに会員)、expired(期限を過ぎた)、not_found。
-- 期限は、確かめるときに、期限そのもので決める(AUTH-016)。
create function public.account_confirm_registration(p_token_hash bytea)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_link public.expiring_links%rowtype;
begin
  select * into v_link
  from public.expiring_links
  where token_hash = p_token_hash
    and purpose = 'registration_confirmation'
    and revoked_at is null
  for update;

  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.members where auth_user_id = v_link.auth_user_id) then
    return 'already_confirmed';
  end if;

  if v_link.expires_at <= now() then
    return 'expired';
  end if;

  -- 同意した日時は、申し込んだ日時(リンクを作った日時)である(FR-212)。
  insert into public.members (auth_user_id, terms_agreed_at)
  values (v_link.auth_user_id, v_link.created_at);

  update public.expiring_links set used_at = now() where id = v_link.id;

  return 'confirmed';
end;
$$;

grant execute on function public.account_confirm_registration(bytea) to service_role;

-- 消す申し込みを選ぶ。会員を指していない Supabase の認証のアカウントで、作ってから1時間を過ぎたもの。
-- リンクの有無では選ばない。データベースへの書き込みが失敗して、リンクのないアカウントが残ることがあるため。
-- 消すのは、Next.js のアプリが、Supabase の認証の管理用の操作で行う。リンクと知らせは、一緒に消える。
-- 管理者(ENT-025)を作るときに、管理者を指しているアカウントを除く条件を足す。
-- auth.users を読むため、定義した者(postgres)の権限で動かす。
create function public.account_list_expired_applications(p_limit integer)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where u.created_at <= now() - interval '1 hour'
    and not exists (select 1 from public.members m where m.auth_user_id = u.id)
  order by u.created_at
  limit p_limit;
$$;

grant execute on function public.account_list_expired_applications(integer) to service_role;

-- 送り直す知らせを選ぶ(IF-105)。期限を過ぎたリンクのメールは、送らない(IF-106)。
create function public.notification_list_unsent(p_limit integer)
returns setof public.sent_notifications
language sql
stable
security invoker
set search_path = ''
as $$
  select n.*
  from public.sent_notifications n
  left join public.expiring_links l on l.id = n.recipient_link_id
  where n.sent_at is null
    and (l.id is null or l.expires_at > now())
  order by n.created_at
  limit p_limit;
$$;

grant execute on function public.notification_list_unsent(integer) to service_role;
