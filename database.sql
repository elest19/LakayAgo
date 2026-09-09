-- Generated schema snapshot from information_schema
-- WARNING: This is generated output, may differ slightly from pg_dump but reflects live schema

-- --------------------------------------------------
-- Table: account
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE account ADD CONSTRAINT account_pkey PRIMARY KEY (id);
ALTER TABLE account ADD CONSTRAINT account_provider_account_unique UNIQUE (provider_id, account_id);
ALTER TABLE account ADD CONSTRAINT account_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX account_pkey ON public.account USING btree (id);
CREATE UNIQUE INDEX account_provider_account_unique ON public.account USING btree (provider_id, account_id);
CREATE INDEX idx_account_user_id ON public.account USING btree (user_id);

-- --------------------------------------------------
-- Table: assets_inventory
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS assets_inventory (
    asset_id bigint NOT NULL,
    name text NOT NULL,
    quantity integer NOT NULL,
    restaurant text NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE assets_inventory ADD CONSTRAINT assets_inventory_pkey PRIMARY KEY (asset_id);
ALTER TABLE assets_inventory ADD CONSTRAINT assets_inventory_quantity_check CHECK ((quantity >= 0));
ALTER TABLE assets_inventory ADD CONSTRAINT assets_inventory_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text])));
CREATE UNIQUE INDEX assets_inventory_pkey ON public.assets_inventory USING btree (asset_id);

-- --------------------------------------------------
-- Table: attendance
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    period_id bigint,
    work_date date NOT NULL,
    first_on_duty time without time zone,
    first_off_duty time without time zone,
    second_on_duty time without time zone,
    second_off_duty time without time zone,
    late_minutes integer DEFAULT 0 NOT NULL,
    leave_early_minutes integer DEFAULT 0 NOT NULL,
    total_minutes integer DEFAULT 0 NOT NULL,
    is_absent boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    is_halfday boolean DEFAULT false NOT NULL,
    on_leave boolean DEFAULT false NOT NULL
);

ALTER TABLE attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (attendance_id);
ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_work_date_key UNIQUE (employee_id, work_date);
ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT attendance_period_id_fkey FOREIGN KEY (period_id) REFERENCES report_periods(report_period_id) ON DELETE SET NULL;
ALTER TABLE attendance ADD CONSTRAINT attendance_overtime_minutes_check CHECK ((overtime_minutes >= 0));
ALTER TABLE attendance ADD CONSTRAINT attendance_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX attendance_pkey ON public.attendance USING btree (attendance_id);
CREATE UNIQUE INDEX attendance_employee_id_work_date_key ON public.attendance USING btree (employee_id, work_date);
CREATE INDEX idx_attendance_employee_date ON public.attendance USING btree (employee_id, work_date);

-- --------------------------------------------------
-- Table: attendance_settings
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_settings (
    id integer DEFAULT nextval('attendance_settings_id_seq'::regclass) NOT NULL,
    grace_period integer DEFAULT 0 NOT NULL,
    required_daily_hours numeric DEFAULT 8.00 NOT NULL,
    break_duration integer DEFAULT 0 NOT NULL,
    overtime_threshold integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    half_day time without time zone DEFAULT '12:00:00'::time without time zone
);

ALTER TABLE attendance_settings ADD CONSTRAINT attendance_settings_pkey PRIMARY KEY (id);
ALTER TABLE attendance_settings ADD CONSTRAINT attendance_settings_break_duration_seconds_check CHECK ((break_duration >= 0));
ALTER TABLE attendance_settings ADD CONSTRAINT attendance_settings_grace_period_seconds_check CHECK ((grace_period >= 0));
ALTER TABLE attendance_settings ADD CONSTRAINT attendance_settings_overtime_threshold_seconds_check CHECK ((overtime_threshold >= 0));
ALTER TABLE attendance_settings ADD CONSTRAINT attendance_settings_required_daily_hours_check CHECK ((required_daily_hours >= (0)::numeric));
CREATE UNIQUE INDEX attendance_settings_pkey ON public.attendance_settings USING btree (id);

-- --------------------------------------------------
-- Table: audit_logs
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id bigint NOT NULL,
    action text NOT NULL,
    table_name text,
    record_id text,
    old_data jsonb,
    new_data jsonb,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant text,
    user_id uuid
);

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (log_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs USING btree (table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);

-- --------------------------------------------------
-- Table: cash_advance_payments
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_advance_payments (
    cash_advance_payments_id bigint NOT NULL,
    cash_advances_id bigint NOT NULL,
    report_period_id bigint,
    amount_deducted numeric DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE cash_advance_payments ADD CONSTRAINT cash_advance_payments_pkey PRIMARY KEY (cash_advance_payments_id);
ALTER TABLE cash_advance_payments ADD CONSTRAINT cash_advance_payments_cash_advances_id_fkey FOREIGN KEY (cash_advances_id) REFERENCES cash_advances(cash_advances_id) ON DELETE CASCADE;
ALTER TABLE cash_advance_payments ADD CONSTRAINT cash_advance_payments_report_period_id_fkey FOREIGN KEY (report_period_id) REFERENCES report_periods(report_period_id) ON DELETE SET NULL;
ALTER TABLE cash_advance_payments ADD CONSTRAINT cash_advance_payments_amount_deducted_check CHECK ((amount_deducted >= (0)::numeric));
CREATE UNIQUE INDEX cash_advance_payments_pkey ON public.cash_advance_payments USING btree (cash_advance_payments_id);
CREATE INDEX idx_cash_advance_payments_advance ON public.cash_advance_payments USING btree (cash_advances_id);
CREATE INDEX idx_cash_advance_payments_period ON public.cash_advance_payments USING btree (report_period_id);

-- --------------------------------------------------
-- Table: cash_advances
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_advances (
    cash_advances_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    date_requested date NOT NULL,
    date_released date,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by bigint,
    remarks text,
    balance_remaining numeric DEFAULT 0 NOT NULL,
    is_fully_paid boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_pkey PRIMARY KEY (cash_advances_id);
ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES employees(employee_id) ON DELETE SET NULL;
ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_balance_remaining_check CHECK ((balance_remaining >= (0)::numeric));
ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
ALTER TABLE cash_advances ADD CONSTRAINT cash_advances_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'released'::text, 'deducted'::text, 'cancelled'::text])));
CREATE UNIQUE INDEX cash_advances_pkey ON public.cash_advances USING btree (cash_advances_id);
CREATE INDEX idx_cash_advances_employee ON public.cash_advances USING btree (employee_id);
CREATE INDEX idx_cash_advances_status ON public.cash_advances USING btree (status);

-- --------------------------------------------------
-- Table: deductions
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS deductions (
    deduction_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    period_id bigint,
    amount numeric DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL
);

ALTER TABLE deductions ADD CONSTRAINT deductions_pkey PRIMARY KEY (deduction_id);
ALTER TABLE deductions ADD CONSTRAINT deductions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
ALTER TABLE deductions ADD CONSTRAINT deductions_period_id_fkey FOREIGN KEY (period_id) REFERENCES report_periods(report_period_id) ON DELETE SET NULL;
ALTER TABLE deductions ADD CONSTRAINT deductions_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX deductions_pkey ON public.deductions USING btree (deduction_id);
CREATE INDEX idx_deductions_employee ON public.deductions USING btree (employee_id);
CREATE INDEX idx_deductions_period ON public.deductions USING btree (period_id);

-- --------------------------------------------------
-- Table: employee_leave_balances
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_leave_balances (
    leave_bal_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    available_leave numeric DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL
);

ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (leave_bal_id);
ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_key UNIQUE (employee_id, leave_type_id);
ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(leave_type_id) ON DELETE CASCADE;
ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_available_leave_check CHECK ((available_leave >= (0)::numeric));
ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX employee_leave_balances_pkey ON public.employee_leave_balances USING btree (leave_bal_id);
CREATE UNIQUE INDEX employee_leave_balances_employee_id_leave_type_id_key ON public.employee_leave_balances USING btree (employee_id, leave_type_id);
CREATE INDEX idx_leave_balances_employee ON public.employee_leave_balances USING btree (employee_id);

-- --------------------------------------------------
-- Table: employees
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    employee_id bigint NOT NULL,
    source_employee_id bigint NOT NULL,
    name text NOT NULL,
    department text,
    pay_per_day numeric,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    contact_number text,
    restaurant text DEFAULT 'Both'::text NOT NULL,
    sss numeric DEFAULT 0,
    philhealth numeric DEFAULT 0,
    pagibig numeric DEFAULT 0,
    email text,
    month_pay_13th numeric
);

ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (employee_id);
ALTER TABLE employees ADD CONSTRAINT employees_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'fired'::text])));
CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (employee_id);
CREATE INDEX idx_employees_status ON public.employees USING btree (status);

-- --------------------------------------------------
-- Table: expenses
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    expense_id bigint NOT NULL,
    name text NOT NULL,
    amount numeric NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL
);

ALTER TABLE expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (expense_id);
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE expenses ADD CONSTRAINT expenses_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX expenses_pkey ON public.expenses USING btree (expense_id);
CREATE INDEX idx_expenses_created_at ON public.expenses USING btree (created_at);

-- --------------------------------------------------
-- Table: food_and_beverage_inventory
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS food_and_beverage_inventory (
    food_and_beverage_id bigint NOT NULL,
    name text NOT NULL,
    price numeric NOT NULL,
    restaurant text NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    servings integer DEFAULT 1 NOT NULL
);

ALTER TABLE food_and_beverage_inventory ADD CONSTRAINT food_and_beverage_inventory_pkey PRIMARY KEY (food_and_beverage_id);
ALTER TABLE food_and_beverage_inventory ADD CONSTRAINT food_and_beverage_inventory_price_check CHECK ((price >= (0)::numeric));
ALTER TABLE food_and_beverage_inventory ADD CONSTRAINT food_and_beverage_inventory_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text])));
ALTER TABLE food_and_beverage_inventory ADD CONSTRAINT food_and_beverage_inventory_servings_check CHECK ((servings > 0));
CREATE UNIQUE INDEX food_and_beverage_inventory_pkey ON public.food_and_beverage_inventory USING btree (food_and_beverage_id);

-- --------------------------------------------------
-- Table: food_and_beverage_recipe
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS food_and_beverage_recipe (
    recipe_id bigint NOT NULL,
    food_and_beverage_id bigint NOT NULL,
    production_inventory_id bigint NOT NULL,
    quantity_required numeric NOT NULL
);

ALTER TABLE food_and_beverage_recipe ADD CONSTRAINT food_and_beverage_recipe_pkey PRIMARY KEY (recipe_id);
ALTER TABLE food_and_beverage_recipe ADD CONSTRAINT food_and_beverage_recipe_dish_ingredient_unique UNIQUE (food_and_beverage_id, production_inventory_id);
ALTER TABLE food_and_beverage_recipe ADD CONSTRAINT food_and_beverage_recipe_food_and_beverage_id_fkey FOREIGN KEY (food_and_beverage_id) REFERENCES food_and_beverage_inventory(food_and_beverage_id) ON DELETE CASCADE;
ALTER TABLE food_and_beverage_recipe ADD CONSTRAINT food_and_beverage_recipe_production_inventory_id_fkey FOREIGN KEY (production_inventory_id) REFERENCES production_inventory(production_inventory_id) ON DELETE RESTRICT;
ALTER TABLE food_and_beverage_recipe ADD CONSTRAINT food_and_beverage_recipe_quantity_required_check CHECK ((quantity_required > (0)::numeric));
CREATE UNIQUE INDEX food_and_beverage_recipe_pkey ON public.food_and_beverage_recipe USING btree (recipe_id);
CREATE UNIQUE INDEX food_and_beverage_recipe_dish_ingredient_unique ON public.food_and_beverage_recipe USING btree (food_and_beverage_id, production_inventory_id);

-- --------------------------------------------------
-- Table: food_package_items
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS food_package_items (
    food_package_item_id bigint NOT NULL,
    food_package_id bigint NOT NULL,
    food_and_beverage_id bigint NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL
);

ALTER TABLE food_package_items ADD CONSTRAINT food_package_items_pkey PRIMARY KEY (food_package_item_id);
ALTER TABLE food_package_items ADD CONSTRAINT food_package_items_food_and_beverage_id_fkey FOREIGN KEY (food_and_beverage_id) REFERENCES food_and_beverage_inventory(food_and_beverage_id) ON DELETE RESTRICT;
ALTER TABLE food_package_items ADD CONSTRAINT food_package_items_food_package_id_fkey FOREIGN KEY (food_package_id) REFERENCES food_packages(food_package_id) ON DELETE CASCADE;
ALTER TABLE food_package_items ADD CONSTRAINT food_package_items_quantity_check CHECK ((quantity > (0)::numeric));
CREATE UNIQUE INDEX food_package_items_pkey ON public.food_package_items USING btree (food_package_item_id);

-- --------------------------------------------------
-- Table: food_packages
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS food_packages (
    food_package_id bigint NOT NULL,
    name text NOT NULL,
    price numeric NOT NULL,
    restaurant text NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE food_packages ADD CONSTRAINT food_packages_pkey PRIMARY KEY (food_package_id);
ALTER TABLE food_packages ADD CONSTRAINT food_packages_price_check CHECK ((price >= (0)::numeric));
ALTER TABLE food_packages ADD CONSTRAINT food_packages_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX food_packages_pkey ON public.food_packages USING btree (food_package_id);

-- --------------------------------------------------
-- Table: holidays
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
    id integer DEFAULT nextval('holidays_id_seq'::regclass) NOT NULL,
    date date NOT NULL,
    holiday_name text NOT NULL,
    type holiday_type DEFAULT 'REGULAR'::holiday_type NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE holidays ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
ALTER TABLE holidays ADD CONSTRAINT holidays_date_key UNIQUE (date);
CREATE UNIQUE INDEX holidays_pkey ON public.holidays USING btree (id);
CREATE UNIQUE INDEX holidays_date_key ON public.holidays USING btree (date);

-- --------------------------------------------------
-- Table: leave_requests
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
    leave_request_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    leave_type_id bigint,
    employee_name text NOT NULL,
    leave_type_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days numeric NOT NULL,
    reason text,
    status text DEFAULT 'Pending'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL
);

ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (leave_request_id);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(leave_type_id) ON DELETE SET NULL;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_check CHECK ((end_date >= start_date));
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_days_check CHECK ((days > (0)::numeric));
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])));
CREATE UNIQUE INDEX leave_requests_pkey ON public.leave_requests USING btree (leave_request_id);
CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (employee_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);
CREATE INDEX idx_leave_requests_leave_type ON public.leave_requests USING btree (leave_type_id);

-- --------------------------------------------------
-- Table: leave_types
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_types (
    leave_type_id bigint NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL,
    leave_number integer DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false NOT NULL
);

ALTER TABLE leave_types ADD CONSTRAINT leave_types_pkey PRIMARY KEY (leave_type_id);
ALTER TABLE leave_types ADD CONSTRAINT leave_types_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX leave_types_pkey ON public.leave_types USING btree (leave_type_id);

-- --------------------------------------------------
-- Table: payroll_settings
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_settings (
    id integer DEFAULT nextval('payroll_settings_id_seq'::regclass) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    undertime_deduction numeric DEFAULT 0 NOT NULL,
    undertime_deduction_rate_type text DEFAULT 'Hour'::text NOT NULL,
    undertime_deduction_rate numeric DEFAULT 0 NOT NULL
);

ALTER TABLE payroll_settings ADD CONSTRAINT payroll_settings_pkey PRIMARY KEY (id);
ALTER TABLE payroll_settings ADD CONSTRAINT payroll_settings_undertime_deduction_check CHECK ((undertime_deduction >= (0)::numeric));
ALTER TABLE payroll_settings ADD CONSTRAINT payroll_settings_undertime_deduction_rate_check CHECK ((undertime_deduction_rate >= (0)::numeric));
ALTER TABLE payroll_settings ADD CONSTRAINT payroll_settings_undertime_deduction_rate_type_check CHECK ((undertime_deduction_rate_type = ANY (ARRAY['Hour'::text, 'Minute'::text])));
CREATE UNIQUE INDEX payroll_settings_pkey ON public.payroll_settings USING btree (id);

-- --------------------------------------------------
-- Table: payslips
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS payslips (
    payslip_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    report_period_id bigint NOT NULL,
    restaurant text NOT NULL,
    base_pay numeric DEFAULT 0 NOT NULL,
    overtime_pay numeric DEFAULT 0 NOT NULL,
    halfday_pay numeric DEFAULT 0 NOT NULL,
    holiday_pay numeric DEFAULT 0 NOT NULL,
    gross_pay numeric DEFAULT 0 NOT NULL,
    sss_deduction numeric DEFAULT 0 NOT NULL,
    philhealth_deduction numeric DEFAULT 0 NOT NULL,
    pagibig_deduction numeric DEFAULT 0 NOT NULL,
    undertime_deduction numeric DEFAULT 0 NOT NULL,
    late_deduction numeric DEFAULT 0 NOT NULL,
    total_deduction numeric DEFAULT 0 NOT NULL,
    net_pay numeric DEFAULT 0 NOT NULL,
    status text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    cash_advance_deduction numeric DEFAULT '0'::numeric NOT NULL,
    paid_leave_pay numeric DEFAULT 0 NOT NULL,
    special_month numeric DEFAULT 0 NOT NULL
);

ALTER TABLE payslips ADD CONSTRAINT payslips_pkey PRIMARY KEY (payslip_id);
ALTER TABLE payslips ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
ALTER TABLE payslips ADD CONSTRAINT payslips_report_period_id_fkey FOREIGN KEY (report_period_id) REFERENCES report_periods(report_period_id) ON DELETE CASCADE;
ALTER TABLE payslips ADD CONSTRAINT payslips_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text])));
ALTER TABLE payslips ADD CONSTRAINT payslips_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'released'::text, 'paid'::text])));
CREATE UNIQUE INDEX payslips_pkey ON public.payslips USING btree (payslip_id);
CREATE INDEX idx_payslips_employee ON public.payslips USING btree (employee_id);
CREATE INDEX idx_payslips_period ON public.payslips USING btree (report_period_id);

-- --------------------------------------------------
-- Table: production_inventory
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS production_inventory (
    production_inventory_id bigint NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    stock numeric NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant text NOT NULL,
    recipe_unit text,
    conversion_factor numeric,
    ingredient_category text
);

ALTER TABLE production_inventory ADD CONSTRAINT production_inventory_pkey PRIMARY KEY (production_inventory_id);
ALTER TABLE production_inventory ADD CONSTRAINT production_inventory_name_restaurant_unique UNIQUE (name, restaurant);
ALTER TABLE production_inventory ADD CONSTRAINT production_inventory_ingredient_category_check CHECK ((ingredient_category = ANY (ARRAY['weight'::text, 'volume'::text, 'quantity'::text])));
ALTER TABLE production_inventory ADD CONSTRAINT production_inventory_restaurant_check CHECK ((restaurant = ANY (ARRAY['Aroo'::text, 'Lakay Ago'::text])));
ALTER TABLE production_inventory ADD CONSTRAINT production_inventory_stock_check CHECK ((stock >= (0)::numeric));
CREATE UNIQUE INDEX production_inventory_pkey ON public.production_inventory USING btree (production_inventory_id);
CREATE UNIQUE INDEX production_inventory_name_restaurant_unique ON public.production_inventory USING btree (name, restaurant);

-- --------------------------------------------------
-- Table: production_inventory_transfers
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS production_inventory_transfers (
    transfer_id bigint NOT NULL,
    from_production_inventory_id bigint NOT NULL,
    to_production_inventory_id bigint NOT NULL,
    quantity numeric NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    transferred_by uuid
);

ALTER TABLE production_inventory_transfers ADD CONSTRAINT production_inventory_transfers_pkey PRIMARY KEY (transfer_id);
ALTER TABLE production_inventory_transfers ADD CONSTRAINT production_inventory_transfer_from_production_inventory_id_fkey FOREIGN KEY (from_production_inventory_id) REFERENCES production_inventory(production_inventory_id) ON DELETE RESTRICT;
ALTER TABLE production_inventory_transfers ADD CONSTRAINT production_inventory_transfers_to_production_inventory_id_fkey FOREIGN KEY (to_production_inventory_id) REFERENCES production_inventory(production_inventory_id) ON DELETE RESTRICT;
ALTER TABLE production_inventory_transfers ADD CONSTRAINT production_inventory_transfers_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE production_inventory_transfers ADD CONSTRAINT production_inventory_transfers_different_rows CHECK ((from_production_inventory_id <> to_production_inventory_id));
ALTER TABLE production_inventory_transfers ADD CONSTRAINT production_inventory_transfers_quantity_check CHECK ((quantity > (0)::numeric));
CREATE UNIQUE INDEX production_inventory_transfers_pkey ON public.production_inventory_transfers USING btree (transfer_id);

-- --------------------------------------------------
-- Table: report_periods
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS report_periods (
    report_period_id bigint NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    tabulation_date date,
    source_file text,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    is_special_month boolean DEFAULT false NOT NULL
);

ALTER TABLE report_periods ADD CONSTRAINT report_periods_pkey PRIMARY KEY (report_period_id);
ALTER TABLE report_periods ADD CONSTRAINT report_periods_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX report_periods_pkey ON public.report_periods USING btree (report_period_id);
CREATE INDEX idx_report_periods_status ON public.report_periods USING btree (status);

-- --------------------------------------------------
-- Table: sales
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    sales_id bigint NOT NULL,
    food_and_beverage_id bigint NOT NULL,
    item text NOT NULL,
    cost numeric NOT NULL,
    number_of_sales integer NOT NULL,
    discount numeric DEFAULT 0 NOT NULL,
    gross_amount numeric,
    net_amount numeric,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant text DEFAULT 'Both'::text NOT NULL
);

ALTER TABLE sales ADD CONSTRAINT sales_pkey PRIMARY KEY (sales_id);
ALTER TABLE sales ADD CONSTRAINT sales_food_and_beverage_fkey FOREIGN KEY (food_and_beverage_id) REFERENCES food_and_beverage_inventory(food_and_beverage_id) ON DELETE RESTRICT;
ALTER TABLE sales ADD CONSTRAINT sales_check CHECK ((discount <= (cost * (number_of_sales)::numeric)));
ALTER TABLE sales ADD CONSTRAINT sales_cost_check CHECK ((cost >= (0)::numeric));
ALTER TABLE sales ADD CONSTRAINT sales_discount_check CHECK ((discount >= (0)::numeric));
ALTER TABLE sales ADD CONSTRAINT sales_number_of_sales_check CHECK ((number_of_sales > 0));
ALTER TABLE sales ADD CONSTRAINT sales_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
CREATE UNIQUE INDEX sales_pkey ON public.sales USING btree (sales_id);
CREATE INDEX idx_sales_inventory ON public.sales USING btree (food_and_beverage_id);
CREATE INDEX idx_sales_created_at ON public.sales USING btree (created_at);

-- --------------------------------------------------
-- Table: service_assets
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS service_assets (
    service_asset_id bigint NOT NULL,
    service_id bigint NOT NULL,
    asset_id bigint NOT NULL,
    quantity_used integer DEFAULT 1 NOT NULL
);

ALTER TABLE service_assets ADD CONSTRAINT service_assets_pkey PRIMARY KEY (service_asset_id);
ALTER TABLE service_assets ADD CONSTRAINT service_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets_inventory(asset_id) ON DELETE RESTRICT;
ALTER TABLE service_assets ADD CONSTRAINT service_assets_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE;
ALTER TABLE service_assets ADD CONSTRAINT service_assets_quantity_used_check CHECK ((quantity_used > 0));
CREATE UNIQUE INDEX service_assets_pkey ON public.service_assets USING btree (service_asset_id);

-- --------------------------------------------------
-- Table: services
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    service_id bigint NOT NULL,
    service_type text NOT NULL,
    restaurant text NOT NULL,
    price numeric NOT NULL,
    expenses numeric DEFAULT 0 NOT NULL,
    food_package_id bigint,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE services ADD CONSTRAINT services_pkey PRIMARY KEY (service_id);
ALTER TABLE services ADD CONSTRAINT services_food_package_id_fkey FOREIGN KEY (food_package_id) REFERENCES food_packages(food_package_id) ON DELETE SET NULL;
ALTER TABLE services ADD CONSTRAINT services_check CHECK (((food_package_id IS NULL) OR (service_type = 'Catering'::text)));
ALTER TABLE services ADD CONSTRAINT services_expenses_check CHECK ((expenses >= (0)::numeric));
ALTER TABLE services ADD CONSTRAINT services_price_check CHECK ((price >= (0)::numeric));
ALTER TABLE services ADD CONSTRAINT services_restaurant_check CHECK ((restaurant = ANY (ARRAY['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])));
ALTER TABLE services ADD CONSTRAINT services_service_type_check CHECK ((service_type = ANY (ARRAY['Catering'::text, 'Photoshoot'::text, 'Accommodation'::text, 'Entrance Fee'::text])));
CREATE UNIQUE INDEX services_pkey ON public.services USING btree (service_id);

-- --------------------------------------------------
-- Table: session
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamptz NOT NULL,
    token text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL
);

ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (id);
ALTER TABLE session ADD CONSTRAINT session_token_key UNIQUE (token);
ALTER TABLE session ADD CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX session_pkey ON public.session USING btree (id);
CREATE UNIQUE INDEX session_token_key ON public.session USING btree (token);
CREATE INDEX idx_session_user_id ON public.session USING btree (user_id);

-- --------------------------------------------------
-- Table: users
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    name text NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    restaurant user_restaurant DEFAULT 'Both'::user_restaurant NOT NULL,
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    updated_at timestamptz DEFAULT now() NOT NULL,
    id uuid NOT NULL
);

ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['Admin'::text, 'SuperAdmin'::text, 'Staff'::text])));
CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (user_id);
CREATE UNIQUE INDEX idx_users_id ON public.users USING btree (id);

-- --------------------------------------------------
-- Table: verification
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE verification ADD CONSTRAINT verification_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX verification_pkey ON public.verification USING btree (id);
CREATE INDEX idx_verification_identifier ON public.verification USING btree (identifier);