-- RBAC: granular admin permissions on the Amaze ID user table.
-- Comma-separated section keys, e.g. "qbank,transport". Superadmins ignore it.
alter table "user" add column "permissions" text;
