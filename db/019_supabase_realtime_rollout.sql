-- Supabase Realtime rollout for the restaurant app
-- Bucket A: public, low-risk catalog/settings tables that can merge row-level updates directly in the client.
-- Bucket B: aggregate or sensitive data tables that should only emit a lightweight signal and refetch through app APIs.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Bucket A tables: direct row merge on the client is safe.
-- Guard each table by existence so the migration does not fail on schema drift or older tables.
do $$
declare
  candidate text;
  table_names text[] := array[
    'public.attendance_settings',
    'public.payroll_settings',
    'public.holidays',
    'public.food_and_beverage_inventory',
    'public.food_packages',
    'public.services',
    'public.sub_services',
    'public.service_sub_services',
    'public.production_inventory',
    'public.assets_inventory',
    'public.employees',
    'public.attendance',
    'public.leave_types',
    'public.leave_requests',
    'public.report_periods',
    'public.cash_advances',
    'public.cash_advance_payments',
    'public.payslips',
    'public.expenses',
    'public.sales',
    'public.service_transactions',
    'public.service_transaction_assets',
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

-- Broad read access for Bucket A data so the app can subscribe without requiring Better Auth user IDs in Realtime filters.
-- These are intentionally permissive because the app keeps sensitive business rules in the API layer, not in standalone client subscriptions.
do $$
declare
  candidate text;
  policy_table_names text[] := array[
    'attendance_settings',
    'payroll_settings',
    'holidays',
    'food_and_beverage_inventory',
    'food_packages',
    'employees',
    'attendance',
    'services',
    'sub_services',
    'report_periods',
    'cash_advances',
    'cash_advance_payments',
    'payslips',
    'expenses',
    'sales',
    'service_transactions',
    'service_transaction_assets',
    'leave_requests',
    'leave_types',
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

-- Bucket B guidance:
-- Keep sales summary and any aggregate-sensitive view on a lightweight event + refetch strategy.
-- The app should listen for the INSERT/UPDATE/DELETE event, then call the authenticated API endpoint that computes totals.
-- Do not merge large aggregate rows directly from a broad Realtime channel intended for all restaurants.

-- Quick verification SQL to run in Supabase SQL Editor after applying the migration:
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
-- select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('attendance_settings','payroll_settings','holidays','food_and_beverage_inventory','services','sub_services');
-- select count(*) from pg_stat_replication; -- optional: confirms the realtime publication is active in the project
