begin;
select plan(1);

select has_schema('public', 'public のスキーマがある(pgTAP が動くことの確かめ)');

select * from finish();
rollback;
