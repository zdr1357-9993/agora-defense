-- 1단계 뒤 확인(읽기만). 모두 true 여야 한다. 직접 쓰기는 아직 열려 있어야 한다(옛 클라이언트 호환).
select 'col_revision' k, exists (select 1 from information_schema.columns where table_schema='public' and table_name='progress' and column_name='revision') ok
union all select 'col_econ_tokens', exists (select 1 from information_schema.columns where table_schema='public' and table_name='progress' and column_name='econ_tokens')
union all select 'table_player_roles', to_regclass('public.player_roles') is not null
union all select 'player_roles_rls_on', (select relrowsecurity from pg_class where oid='public.player_roles'::regclass)
union all select 'player_roles_no_client_write', not exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='player_roles' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE'))
union all select 'fn_save_progress', to_regprocedure('public.save_progress(text,jsonb,bigint)') is not null
union all select 'trigger_revision', exists (select 1 from pg_trigger where tgrelid='public.progress'::regclass and tgname='progress_revision')
union all select 'still_direct_update_for_old_client', has_table_privilege('authenticated','public.progress','UPDATE');
