-- Ensure expenses and related public tables are part of the realtime publication and have public read access.
-- This fixes cases where the table is in the publication list but lacks a select policy, which causes local-only updates.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  candidate text;
  table_names text[] := array[
    'public.expenses',
    'public.sales',
    'public.service_transactions',
    'public.audit_logs'
  ];
begin
  foreach candidate in array table_names loop
    if to_regclass(candidate) is not null then
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = split_part(candidate, '.', 1)
          and tablename = split_part(candidate, '.', 2)
      ) then
        execute format('alter publication %I add table %s', 'supabase_realtime', candidate);
      end if;
    end if;
  end loop;
end $$;

do $$
declare
  candidate text;
  policy_table_names text[] := array[
    'expenses',
    'sales',
    'service_transactions',
    'audit_logs'
  ];
begin
  foreach candidate in array policy_table_names loop
    if to_regclass(format('public.%I', candidate)) is not null then
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = candidate
          and policyname = candidate || '_realtime_select_public'
      ) then
        execute format(
          'create policy %I on public.%I for select to authenticated, anon using (true)',
          candidate || '_realtime_select_public',
          candidate
        );
      end if;
    end if;
  end loop;
end $$;

-- Quick verification:
-- select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('expenses', 'sales', 'service_transactions', 'audit_logs');
-- select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('expenses', 'sales', 'service_transactions', 'audit_logs');
