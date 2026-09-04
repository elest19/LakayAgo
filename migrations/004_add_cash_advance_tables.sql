create table if not exists cash_advances (
    cash_advances_id bigint generated always as identity primary key,

    employee_id bigint not null
        references employees(employee_id)
        on delete cascade,

    restaurant text not null default 'Both'
        check (restaurant in ('Lakay Ago', 'Aroo', 'Both')),

    amount numeric(10,2) not null default 0
        check (amount >= 0),

    date_requested date not null,

    date_released date,

    status text not null default 'pending'
        check (status in ('pending', 'approved', 'released', 'deducted', 'cancelled')),

    approved_by bigint
        references employees(employee_id)
        on delete set null,

    remarks text,

    balance_remaining numeric(10,2) not null default 0
        check (balance_remaining >= 0),

    is_fully_paid boolean not null default false,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

create table if not exists cash_advance_payments (
    cash_advance_payments_id bigint generated always as identity primary key,

    cash_advances_id bigint not null
        references cash_advances(cash_advances_id)
        on delete cascade,

    report_period_id bigint
        references report_periods(report_period_id)
        on delete set null,

    amount_deducted numeric(10,2) not null default 0
        check (amount_deducted >= 0),

    created_at timestamptz not null default now()
);

create or replace function refresh_cash_advance_totals()
returns trigger as $$
begin
    update cash_advances ca
    set
        balance_remaining = greatest(
            ca.amount - coalesce((
                select sum(cap.amount_deducted)
                from cash_advance_payments cap
                where cap.cash_advances_id = ca.cash_advances_id
            ), 0), 0),
        is_fully_paid = (
            ca.amount - coalesce((
                select sum(cap.amount_deducted)
                from cash_advance_payments cap
                where cap.cash_advances_id = ca.cash_advances_id
            ), 0)
        ) <= 0,
        updated_at = now()
    where ca.cash_advances_id = coalesce(new.cash_advances_id, old.cash_advances_id);

    return coalesce(new, old);
end;
$$ language plpgsql;

create trigger if not exists cash_advance_payment_balance_refresh
after insert or update of amount_deducted, delete on cash_advance_payments
for each row
execute procedure refresh_cash_advance_totals();

create index if not exists idx_cash_advances_employee on cash_advances (employee_id);
create index if not exists idx_cash_advances_status on cash_advances (status);
create index if not exists idx_cash_advance_payments_advance on cash_advance_payments (cash_advances_id);
create index if not exists idx_cash_advance_payments_period on cash_advance_payments (report_period_id);
