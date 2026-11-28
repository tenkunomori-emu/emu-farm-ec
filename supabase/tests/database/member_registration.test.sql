-- 会員の登録の申し込みと確認(Issue #227)の表と関数を確かめる。
-- 期限は、記録した日時を過去にして確かめる(基本設計書の TST-025)。
begin;
select plan(33);

-- 表は、行ごとの決まり(RLS)が有効で、anon と authenticated から届かない(AUTH-039〜AUTH-041、TST-036)。
select ok(
  (select relrowsecurity from pg_class where oid = 'public.members'::regclass),
  '会員の表は、RLS が有効'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.expiring_links'::regclass),
  '期限のあるリンクの表は、RLS が有効'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sent_notifications'::regclass),
  '送った知らせの表は、RLS が有効'
);

select ok(
  not has_table_privilege('anon', 'public.members', 'select, insert, update, delete'),
  '会員の表は、anon から届かない'
);
select ok(
  not has_table_privilege('authenticated', 'public.members', 'select, insert, update, delete'),
  '会員の表は、authenticated から届かない'
);
select ok(
  not has_table_privilege('anon', 'public.expiring_links', 'select, insert, update, delete'),
  '期限のあるリンクの表は、anon から届かない'
);
select ok(
  not has_table_privilege('authenticated', 'public.expiring_links', 'select, insert, update, delete'),
  '期限のあるリンクの表は、authenticated から届かない'
);
select ok(
  not has_table_privilege('anon', 'public.sent_notifications', 'select, insert, update, delete'),
  '送った知らせの表は、anon から届かない'
);
select ok(
  not has_table_privilege('authenticated', 'public.sent_notifications', 'select, insert, update, delete'),
  '送った知らせの表は、authenticated から届かない'
);

select ok(
  has_table_privilege('service_role', 'public.members', 'select, insert, update')
  and has_table_privilege('service_role', 'public.expiring_links', 'select, insert, update, delete')
  and has_table_privilege('service_role', 'public.sent_notifications', 'select, insert, update'),
  'service_role は、3つの表を使える'
);
select ok(
  has_function_privilege('service_role', 'public.account_record_registration(uuid, uuid, bytea, timestamptz, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.account_confirm_registration(bytea)', 'execute')
  and has_function_privilege('service_role', 'public.account_list_expired_applications(integer)', 'execute')
  and has_function_privilege('service_role', 'public.notification_list_unsent(integer)', 'execute'),
  'service_role は、4つの関数を呼べる'
);

select ok(
  not has_function_privilege('anon', 'public.account_record_registration(uuid, uuid, bytea, timestamptz, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.account_record_registration(uuid, uuid, bytea, timestamptz, uuid)', 'execute'),
  '申し込みを記録する関数は、anon と authenticated から呼べない'
);
select ok(
  not has_function_privilege('anon', 'public.account_confirm_registration(bytea)', 'execute')
  and not has_function_privilege('authenticated', 'public.account_confirm_registration(bytea)', 'execute'),
  '会員にする関数は、anon と authenticated から呼べない'
);
select ok(
  not has_function_privilege('anon', 'public.account_list_expired_applications(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.account_list_expired_applications(integer)', 'execute'),
  '消す申し込みを選ぶ関数は、anon と authenticated から呼べない'
);
select ok(
  not has_function_privilege('anon', 'public.notification_list_unsent(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.notification_list_unsent(integer)', 'execute'),
  '送り直す知らせを選ぶ関数は、anon と authenticated から呼べない'
);

-- テストの記録を作る。
-- 申し込み A: 期限の中。申し込み B: 期限を過ぎた。申し込み C: 作ってから1時間を過ぎ、リンクがない。
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com', now() - interval '2 hours');

select lives_ok(
  $$ select public.account_record_registration(
       '00000000-0000-0000-0000-00000000000a',
       '10000000-0000-0000-0000-00000000000a',
       '\xaa',
       now() + interval '1 hour',
       '20000000-0000-0000-0000-00000000000a') $$,
  '申し込みを記録できる'
);

select is(
  (select count(*)::int from public.sent_notifications
   where recipient_link_id = '10000000-0000-0000-0000-00000000000a' and kind = 'registration_confirmation'),
  1,
  '申し込みと同じ書き込みで、登録の確認の知らせが記録される'
);

select throws_ok(
  $$ select public.account_record_registration(
       '00000000-0000-0000-0000-00000000000a',
       '10000000-0000-0000-0000-0000000000a2',
       '\xab',
       now() + interval '1 hour',
       '20000000-0000-0000-0000-0000000000a2') $$,
  '23505',
  null,
  '同じアカウントに、使える登録の確認のリンクを2つ作れない'
);

-- 申し込み B は、2時間前に申し込み、1時間前に期限を過ぎた。
insert into public.expiring_links (id, purpose, auth_user_id, token_hash, expires_at, created_at)
values ('10000000-0000-0000-0000-00000000000b', 'registration_confirmation',
        '00000000-0000-0000-0000-00000000000b', '\xbb',
        now() - interval '1 hour', now() - interval '2 hours');
insert into public.sent_notifications (id, kind, recipient_link_id, created_at)
values ('20000000-0000-0000-0000-00000000000b', 'registration_confirmation',
        '10000000-0000-0000-0000-00000000000b', now() - interval '2 hours');

select throws_ok(
  $$ insert into public.sent_notifications (id, kind)
     values ('20000000-0000-0000-0000-0000000000f1', 'registration_confirmation') $$,
  '23514',
  null,
  '宛先のない知らせは、記録できない'
);
select throws_ok(
  $$ insert into public.sent_notifications (id, kind, recipient_link_id)
     values ('20000000-0000-0000-0000-0000000000f2', 'already_registered',
             '10000000-0000-0000-0000-00000000000a') $$,
  '23514',
  null,
  'すでに登録されている知らせの宛先は、会員だけ'
);

-- 送り直す知らせ(IF-105、IF-106)。
select is(
  (select array_agg(id order by id) from public.notification_list_unsent(100)),
  array['20000000-0000-0000-0000-00000000000a'::uuid],
  '送り直す知らせに、期限を過ぎたリンクのメールは入らない'
);

-- 会員にする(FR-141、FR-220、AUTH-016、AUTH-017)。
select is(public.account_confirm_registration('\xff'), 'not_found', '知らないリンクでは、会員にならない');
select is(public.account_confirm_registration('\xbb'), 'expired', '期限を過ぎたリンクでは、会員にならない');
select is(
  (select count(*)::int from public.members where auth_user_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  '期限を過ぎたリンクでは、会員が作られない'
);

select is(public.account_confirm_registration('\xaa'), 'confirmed', '期限の中のリンクで、会員になる');
select is(
  (select m.terms_agreed_at from public.members m
   where m.auth_user_id = '00000000-0000-0000-0000-00000000000a'),
  (select l.created_at from public.expiring_links l where l.id = '10000000-0000-0000-0000-00000000000a'),
  '同意した日時は、申し込んだ日時(リンクを作った日時)'
);
select isnt(
  (select used_at from public.expiring_links where id = '10000000-0000-0000-0000-00000000000a'),
  null,
  'リンクに、使われた日時が記録される'
);
select is(
  public.account_confirm_registration('\xaa'),
  'already_confirmed',
  '同じリンクをもう一度使っても、会員は増えない'
);
select is(
  (select count(*)::int from public.members where auth_user_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  '会員は1件のまま'
);

-- 消す申し込み(AUTH-019)。
select is(
  (select array_agg(x order by x) from public.account_list_expired_applications(100) as x),
  array['00000000-0000-0000-0000-00000000000b'::uuid, '00000000-0000-0000-0000-00000000000c'::uuid],
  '会員を指さず、作ってから1時間を過ぎたアカウントだけが選ばれる(リンクがないものを含む)'
);
select is(
  (select count(*)::int from public.account_list_expired_applications(1)),
  1,
  '1回に選ぶ数は、上限を超えない(OPS-031)'
);

-- 申し込みのアカウントを消すと、リンクと知らせも消える。
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select count(*)::int from public.expiring_links where id = '10000000-0000-0000-0000-00000000000b'),
  0,
  '申し込みのアカウントを消すと、リンクも消える'
);
select is(
  (select count(*)::int from public.sent_notifications where id = '20000000-0000-0000-0000-00000000000b'),
  0,
  '申し込みのアカウントを消すと、知らせの記録も消える'
);

select * from finish();
rollback;
