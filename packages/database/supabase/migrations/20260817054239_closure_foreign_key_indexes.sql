begin;

create index time_block_closure_time_block_idx on public.time_block_closure(time_block_id);
create index time_block_closure_created_by_user_idx on public.time_block_closure(created_by_user_id);

commit;
