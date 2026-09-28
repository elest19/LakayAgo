-- Migration 032: Add total_leave to employee_leave_balances, backfill, and add triggers

begin;

-- 1) Add total_leave column with non-negative constraint
alter table public.employee_leave_balances
  add column if not exists total_leave numeric(5,1) not null default 0,
  add constraint employee_leave_balances_total_check check (total_leave >= 0);

-- 2) Backfill existing behavior: give each ACTIVE employee every non-archived leave type
--    that matches their restaurant, using the global leave_types.leave_number, minus approved days used.
insert into public.employee_leave_balances
  (employee_id, leave_type_id, total_leave, available_leave, restaurant, created_at, updated_at)
select e.employee_id, lt.leave_type_id, lt.leave_number,
       greatest(lt.leave_number - coalesce(u.used, 0), 0), lt.restaurant, now(), now()
from public.employees e
join public.leave_types lt
  on (lt.restaurant = 'Both' or e.restaurant = 'Both' or lt.restaurant = e.restaurant)
left join (
  select employee_id, leave_type_id, sum(days) as used
  from public.leave_requests
  where status = 'Approved' and leave_type_id is not null
  group by 1, 2
) u on u.employee_id = e.employee_id and u.leave_type_id = lt.leave_type_id
where e.status = 'active' and lt.is_archived = false
on conflict (employee_id, leave_type_id) do update
  set total_leave = excluded.total_leave,
      available_leave = excluded.available_leave,
      updated_at = now();

-- 3) Also ensure any (employee, leave_type) pairs that already have leave_requests exist
--    This preserves historical requests for inactive employees / archived types.
insert into public.employee_leave_balances
  (employee_id, leave_type_id, total_leave, available_leave, restaurant, created_at, updated_at)
select r.employee_id, r.leave_type_id, coalesce(lt.leave_number,0), greatest(coalesce(lt.leave_number,0) - coalesce(u.used,0),0), coalesce(lt.restaurant,'Both'), now(), now()
from (
  select distinct employee_id, leave_type_id
  from public.leave_requests
  where leave_type_id is not null
) r
left join public.leave_types lt on lt.leave_type_id = r.leave_type_id
left join (
  select employee_id, leave_type_id, sum(days) as used
  from public.leave_requests
  where status = 'Approved' and leave_type_id is not null
  group by 1,2
) u on u.employee_id = r.employee_id and u.leave_type_id = r.leave_type_id
on conflict (employee_id, leave_type_id) do nothing;

-- 4) Trigger T1: Validate assignment and copy restaurant
create or replace function trg_employee_leave_balances_validate()
returns trigger
language plpgsql
as $$
declare
  emp_rest text;
  lt_rest text;
  lt_arch boolean;
begin
  if new.leave_type_id is null or new.employee_id is null then
    return new;
  end if;

  select restaurant into emp_rest from public.employees where employee_id = new.employee_id limit 1;
  select restaurant, coalesce(is_archived,false) into lt_rest, lt_arch from public.leave_types where leave_type_id = new.leave_type_id limit 1;

  if lt_rest is null then
    raise exception 'Leave type not found';
  end if;

  -- Restaurant mismatch: if neither is 'Both' and values differ, reject
  if lt_rest <> 'Both' and emp_rest <> 'Both' and lt_rest is not null and emp_rest is not null and lt_rest <> emp_rest then
    raise exception 'Leave type is not available for this employee''s restaurant';
  end if;

  if (tg_op = 'INSERT') then
    if lt_arch then
      raise exception 'Cannot assign an archived leave type';
    end if;
    -- New assignment starts with full available leave
    new.available_leave := new.total_leave;
  end if;

  -- Copy leave type restaurant into the balance row
  new.restaurant := lt_rest;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_before_employee_leave_balances_ins_upd
  before insert or update of employee_id, leave_type_id on public.employee_leave_balances
  for each row
  execute function trg_employee_leave_balances_validate();

-- 5) Trigger T2: Keep available_leave in step when total_leave edited
create or replace function trg_employee_leave_balances_total_update()
returns trigger
language plpgsql
as $$
begin
  -- Only run when total_leave changed; the WHEN clause on the trigger ensures this
  new.available_leave := old.available_leave + (new.total_leave - old.total_leave);
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_before_employee_leave_balances_total_update
  before update on public.employee_leave_balances
  for each row
  when (old.total_leave is distinct from new.total_leave)
  execute function trg_employee_leave_balances_total_update();

-- 6) Trigger T3: Ensure a request can only use an assigned leave type
create or replace function trg_leave_requests_validate_assignment()
returns trigger
language plpgsql
as $$
declare
  exists_row integer;
begin
  if new.leave_type_id is null then
    return new;
  end if;

  select 1 into exists_row from public.employee_leave_balances where employee_id = new.employee_id and leave_type_id = new.leave_type_id limit 1;
  if not found then
    raise exception 'This leave type is not assigned to the employee';
  end if;
  return new;
end;
$$;

create trigger trg_before_leave_requests_validate_assignment
  before insert or update of employee_id, leave_type_id on public.leave_requests
  for each row
  execute function trg_leave_requests_validate_assignment();

-- 7) Trigger T4: Deduct and refund balance on approval changes
create or replace function trg_leave_requests_adjust_balance()
returns trigger
language plpgsql
as $$
declare
  v_days numeric(5,1);
begin
  -- Handle DELETE: refund if OLD was approved
  if tg_op = 'DELETE' then
    if old.status = 'Approved' and old.leave_type_id is not null then
      update public.employee_leave_balances
      set available_leave = available_leave + old.days, updated_at = now()
      where employee_id = old.employee_id and leave_type_id = old.leave_type_id;
    end if;
    return old;
  end if;

  -- At this point TG_OP is INSERT or UPDATE
  -- On UPDATE, first refund old approved amount (if any)
  if tg_op = 'UPDATE' then
    if old.status = 'Approved' and old.leave_type_id is not null then
      update public.employee_leave_balances
      set available_leave = available_leave + old.days, updated_at = now()
      where employee_id = old.employee_id and leave_type_id = old.leave_type_id;
    end if;
  end if;

  -- Now if NEW is approved, deduct
  if new.status = 'Approved' and new.leave_type_id is not null then
    v_days := coalesce(new.days,0);
    -- Use conditional update to ensure sufficient balance
    update public.employee_leave_balances
    set available_leave = available_leave - v_days, updated_at = now()
    where employee_id = new.employee_id and leave_type_id = new.leave_type_id and available_leave >= v_days;

    if found then
      return new;
    else
      -- No row updated: either no assignment or insufficient balance
      raise exception 'Insufficient leave balance';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_after_leave_requests_adjust_balance
  after insert or update or delete on public.leave_requests
  for each row
  execute function trg_leave_requests_adjust_balance();

commit;
