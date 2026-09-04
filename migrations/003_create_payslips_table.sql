-- Migration: create payslips table
-- Adds a `payslips` table to record generated payslips (final calculated figures)

create table if not exists payslips (
    payslip_id bigint generated always as identity primary key,

    employee_id bigint not null
        references employees(employee_id)
        on delete cascade,

    report_period_id bigint not null
        references report_periods(report_period_id)
        on delete cascade,

    restaurant text not null
        check (restaurant in ('Lakay Ago', 'Aroo')),

    -- Employee snapshot fields
    employee_name text not null,
    employee_number text,
    position text,
    department text,

    -- Earnings
    base_pay numeric(12,2) not null default 0,
    overtime_pay numeric(12,2) not null default 0,
    halfday_pay numeric(12,2) not null default 0,
    holiday_pay numeric(12,2) not null default 0,
    gross_pay numeric(12,2) not null default 0,

    -- Deductions
    sss_deduction numeric(12,2) not null default 0,
    philhealth_deduction numeric(12,2) not null default 0,
    pagibig_deduction numeric(12,2) not null default 0,
    undertime_deduction numeric(12,2) not null default 0,
    late_deduction numeric(12,2) not null default 0,
    cash_advance_deduction numeric(12,2) not null default 0,
    total_deduction numeric(12,2) not null default 0,

    -- Result
    net_pay numeric(12,2) not null default 0,

    -- Metadata
    status text not null
        check (status in ('draft','released','paid')),
    created_at timestamptz not null default now()
);

create index if not exists idx_payslips_employee on payslips(employee_id);
create index if not exists idx_payslips_period on payslips(report_period_id);
