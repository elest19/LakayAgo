ALTER TABLE report_periods
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending';

COMMENT ON COLUMN report_periods.status IS 'Payroll period status: Pending, Attendance Imported, Validation Required, Ready for Payroll, Calculated, Under Review, Approved, Finalized';

CREATE INDEX IF NOT EXISTS idx_report_periods_status ON report_periods(status);