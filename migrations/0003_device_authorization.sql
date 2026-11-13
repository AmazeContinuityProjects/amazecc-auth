-- RFC 8628 device authorization grant (better-auth `device-authorization` plugin,
-- wired into the oauth-provider's shared issuance via `oauthDeviceAuthorization`).
-- The base plugin owns the deviceCode record (deviceCode/userCode/status/polling);
-- the provider bridge adds `oauthClientId` (registered-client binding) and
-- `resources` (RFC 8707 audience binding) as device-code schema fields.
create table "deviceCode" (
  "id" text not null primary key,
  "deviceCode" text not null unique,
  "userCode" text not null unique,
  "userId" text references "user" ("id") on delete cascade,
  "expiresAt" date not null,
  "status" text not null,
  "lastPolledAt" date,
  "pollingInterval" integer,
  "clientId" text,
  "scope" text,
  "oauthClientId" text,
  "resources" text
);
