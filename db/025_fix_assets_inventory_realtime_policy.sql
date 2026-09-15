-- Ensure the assets_inventory catalog table is fully wired for Supabase Realtime.
-- 019_supabase_realtime_rollout.sql added assets_inventory to the publication but
-- omitted it from the realtime select-policy list, so subscribers receive nothing and
-- only the user who made the change sees it (everyone else needs a manual refresh).
-- This is the same defect fixed for expenses in 022_fix_expenses_realtime_policy.sql
-- and for production_inventory in 024_fix_production_inventory_realtime_policy.sql.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 1) (Re-)guard publication membership in case the rollout migration was not applied yet.
do $$
declare
  candidate text;
  table_names text[] := array[
    'public.assets_inventory'
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

-- 2) Public read policy so Realtime subscribers (anon/authenticated) are allowed to receive changes.
--    Intentionally permissive, matching the 019/022/024 realtime policy pattern; sensitive
--    business rules stay in the API layer.
do $$
declare
  candidate text;
  policy_table_names text[] := array[
    'assets_inventory'
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

-- Quick verification to run in the Supabase SQL Editor after applying:
-- select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'assets_inventory';
-- select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename = 'assets_inventory';