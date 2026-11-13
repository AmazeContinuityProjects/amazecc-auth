import { betterAuth } from "better-auth";
import { admin as adminPlugin, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import type { AuthEnv } from "./env";
import { vtopLink } from "./plugins/vtop-link";

export function createAuth(env: AuthEnv, databaseOverride?: unknown) {
  const trustedOrigins = [
    env.BETTER_AUTH_URL,
    ...(env.TRUSTED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  ];

  return betterAuth({
    appName: "Amaze ID",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,

    // D1 binding on Cloudflare Workers (better-auth ≥1.5 auto-detects it).
    // Tests and the schema generator pass an override instead.
    database: (databaseOverride ?? env.DB) as never,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // No email provider is wired up yet (no Resend/SMTP in the stack).
      // Turn this on once `sendVerificationEmail` is configured.
      requireEmailVerification: false,
    },

    user: {
      additionalFields: {
        /** VTOP reg number, mirrored from the linked `vtop` account row. Server-set only. */
        vtopRegNo: {
          type: "string",
          required: false,
          input: false,
        },
        /**
         * Granular admin permissions, comma-separated section keys
         * (see amazecc-api-hono src/lib/permissions.ts). Superadmins ignore it.
         * Server-set only (managed through /api/admin/users/*, D1 writes).
         */
        permissions: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },

    session: {
      // 30-day rolling sessions; refreshed on activity (updateAge).
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },

    rateLimit: {
      enabled: true,
      storage: "database",
    },

    advanced: {
      ipAddress: {
        // Cloudflare sets cf-connecting-ip and strips client-supplied values.
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      // Local dev only: this machine's network filter intermittently rewrites
      // the Origin header of requests to localhost (see README). Never set in
      // production — .dev.vars is gitignored and never deployed.
      ...(env.DISABLE_ORIGIN_CHECK === "true" ? { disableOriginCheck: true } : {}),
    },

    plugins: [
      // JWT signs with the same key the OAuth provider issues token JWTs with.
      jwt({ disableSettingJwtHeader: true }),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
        allowDynamicClientRegistration: false,
        // Only admins/superadmins may register/manage OAuth clients. Without
        // this, any authenticated session could register a new client.
        clientPrivileges: async ({ user }) => {
          const role = (user as { role?: string } | undefined)?.role;
          return role === "admin" || role === "superadmin";
        },
        // Allow plain-HTTP redirect URIs ONLY on literal loopback hosts, for
        // local development of the client apps. Everything else stays strict.
        allowInsecureRedirectUri: (url) =>
          url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"),
      }),
      // Role hierarchy: `superadmin` > `admin` (granular permissions) > `user`.
      adminPlugin({
        defaultRole: "user",
        adminRoles: ["superadmin"],
      }),
      vtopLink(env),
    ],
  });
}

export type AmazeAuth = ReturnType<typeof createAuth>;
