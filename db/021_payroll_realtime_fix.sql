-- Fix payroll-related realtime visibility for previously applied rollout scripts.
-- This adds the payroll tables to the publication and public read policy so
-- report periods, cash advances, payment ledger entries, and payslips update live across users.

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
    'public.report_periods',
    'public.cash_advances',
    'public.cash_advance_payments',
    'public.payslips'
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
    'report_periods',
    'cash_advances',
    'cash_advance_payments',
    'payslips'
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
