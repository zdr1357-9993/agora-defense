-- 1단계 전 점검(읽기만, 여러 번 실행 가능). 결과를 복사해 두면 롤백 판단 근거가 된다.
select 'rows' as what, count(*)::text as value from public.progress
union all select 'rows_with_data_role', count(*)::text from public.progress where data ? 'role'
union all select 'rows_data_not_object', count(*)::text from public.progress where jsonb_typeof(data) <> 'object'
union all select 'rows_gonoe_over_1e8', count(*)::text from public.progress where jsonb_typeof(data->'gonoe')='number' and (data->>'gonoe')::numeric > 1e8
union all select 'rows_gems_over_1e6', count(*)::text from public.progress where jsonb_typeof(data->'gems')='number' and (data->>'gems')::numeric > 1e6
union all select 'rows_tickets_over_1000', count(*)::text from public.progress where jsonb_typeof(data->'tickets')='number' and (data->>'tickets')::numeric > 1000
union all select 'rows_currency_not_number', count(*)::text from public.progress where exists (select 1 from unnest(array['gonoe','gems','tickets']) k where data ? k and jsonb_typeof(data->k) <> 'number')
union all select 'col_revision_exists', (exists (select 1 from information_schema.columns where table_schema='public' and table_name='progress' and column_name='revision'))::text
union all select 'table_player_roles_exists', (to_regclass('public.player_roles') is not null)::text
union all select 'fn_save_progress_exists', (to_regprocedure('public.save_progress(text,jsonb,bigint)') is not null)::text;
-- 정책·권한·트리거
select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='progress' order by 1;
select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='progress' and grantee in ('anon','authenticated','public') order by 1,2;
select tgname from pg_trigger where tgrelid='public.progress'::regclass and not tgisinternal order by 1;
