-- 2단계 되돌리기(여러 번 실행 가능): 직접 쓰기를 다시 열고 재화 검사 트리거를 뗀다. 1단계 것(RPC·revision·역할 표)은 남는다.
drop trigger if exists progress_guard on public.progress;
grant select, insert, update on public.progress to authenticated;
