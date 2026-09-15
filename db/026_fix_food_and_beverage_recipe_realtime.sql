-- Ensure the food_and_beverage_recipe table is fully wired for Supabase Realtime.
-- Recipe rows are edited through /api/food_and_beverage_recipe (the inline recipe
-- editor), which writes ONLY the food_and_beverage_recipe table. That table was
-- missing from the realtime publication and had no select policy, so recipe changes
-- produced no realtime events and only the user who made the change saw them.
-- Also adds the missing select policy for service_sub_services (in the publication
-- since 019 but omitted from its policy list — preemptive, same defect class as
-- production_inventory/assets_inventory fixed in 024/025).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 1) (Re-)guard publication membership.
do $$
declare
  candidate text;
  table_names text[] := array[
    'public.food_and_beverage_recipe',
    'public.service_sub_services'
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

-- 2) Public read policies so Realtime subscribers (anon/authenticated) are allowed
--    to receive changes. Intentionally permissive, matching the 019/022/024/025
--    realtime policy pattern; sensitive business rules stay in the API layer.
do $$
declare
  candidate text;
  policy_table_names text[] := array[
    'food_and_beverage_recipe',
    'service_sub_services'
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
-- select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('food_and_beverage_recipe', 'service_sub_services');
-- select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('food_and_beverage_recipe', 'service_sub_services');