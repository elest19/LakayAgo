-- Migration: allow free-form service_type names (e.g. "Catering 1 - Large")
-- The Add/Edit Services form is now typeable with suggestions, so the
-- CHECK constraint limiting service_type to the 4 original values must go.
alter table public.services
  drop constraint if exists services_service_type_check;