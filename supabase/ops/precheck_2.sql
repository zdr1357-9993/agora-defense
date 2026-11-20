-- 2단계 전 점검(읽기만). 1단계가 확인됐고(verify_1 전부 true) 새 클라이언트가 배포돼 있어야 한다.
-- 'rows_saved_by_rpc_era' 는 새 클라이언트가 실제로 저장하고 있는지의 간접 지표(1단계 뒤 revision 이 1 이상인 줄 수).
select 'verify_1_fn', to_regprocedure('public.save_progress(text,jsonb,bigint)') is not null
union all select 'verify_1_trigger', exists (select 1 from pg_trigger where tgrelid='public.progress'::regclass and tgname='progress_revision');
select 'rows' k, count(*) v from public.progress
union all select 'rows_saved_since_stage1', count(*) from public.progress where revision >= 1
union all select 'rows_with_data_role', count(*) from public.progress where data ? 'role'
union all select 'rows_over_cap_any', count(*) from public.progress p where exists (select 1 from public.econ_limits() l where jsonb_typeof(p.data->l.k)='number' and (p.data->>l.k)::numeric > l.total_cap)
union all select 'master_count', count(*) from public.player_roles where role='master';
select r.role, u.email from public.player_roles r join auth.users u on u.id = r.user_id order by 1, 2;
