-- 2단계 뒤 확인(읽기만). 모두 true 여야 한다.
select 'no_direct_insert' k, not has_table_privilege('authenticated','public.progress','INSERT') ok
union all select 'no_direct_update', not has_table_privilege('authenticated','public.progress','UPDATE')
union all select 'no_direct_delete', not has_table_privilege('authenticated','public.progress','DELETE')
union all select 'still_select', has_table_privilege('authenticated','public.progress','SELECT')
union all select 'rpc_executable', has_function_privilege('authenticated','public.save_progress(text,jsonb,bigint)','EXECUTE')
union all select 'anon_no_rpc', not has_function_privilege('anon','public.save_progress(text,jsonb,bigint)','EXECUTE')
union all select 'trigger_guard', exists (select 1 from pg_trigger where tgrelid='public.progress'::regclass and tgname='progress_guard' and tgenabled <> 'D')
union all select 'trigger_revision', exists (select 1 from pg_trigger where tgrelid='public.progress'::regclass and tgname='progress_revision');
