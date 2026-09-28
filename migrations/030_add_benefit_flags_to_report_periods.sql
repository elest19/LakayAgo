-- Add per-period benefit toggles: is_sss_enabled, is_philhealth_enabled, is_pagibig_enabled
ALTER TABLE report_periods
  ADD COLUMN IF NOT EXISTS is_sss_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_philhealth_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_pagibig_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN report_periods.is_sss_enabled IS 'Whether SSS deductions are applied for this report period';
COMMENT ON COLUMN report_periods.is_philhealth_enabled IS 'Whether PhilHealth deductions are applied for this report period';
COMMENT ON COLUMN report_periods.is_pagibig_enabled IS 'Whether Pag-IBIG deductions are applied for this report period';

CREATE INDEX IF NOT EXISTS idx_report_periods_is_sss_enabled ON report_periods(is_sss_enabled);
CREATE INDEX IF NOT EXISTS idx_report_periods_is_philhealth_enabled ON report_periods(is_philhealth_enabled);
CREATE INDEX IF NOT EXISTS idx_report_periods_is_pagibig_enabled ON report_periods(is_pagibig_enabled);
