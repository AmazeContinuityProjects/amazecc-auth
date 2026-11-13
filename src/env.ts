/** Environment contract for the amazecc-auth worker. */
export interface AuthEnv {
  /** 32+ byte random secret (wrangler secret put BETTER_AUTH_SECRET). */
  BETTER_AUTH_SECRET: string;
  /** Canonical issuer URL, e.g. https://auth.amazecc.com */
  BETTER_AUTH_URL: string;

  /** D1 binding backing users/sessions/accounts. */
  DB: D1Database;

  /**
   * Where to verify VTOP credentials server-to-server. Defaults to the
   * production scraper. Auth never stores VTOP passwords; it calls this
   * endpoint once during account linking and discards the credentials.
   */
  VTOP_LOGIN_URL?: string;
  /**
   * Optional shared secret sent as `x-service-secret` when calling the VTOP
   * scraper. The scraper ignores unknown headers today, so this is optional
   * until the scraper enforces it.
   */
  VTOP_SERVICE_SECRET?: string;

  /** Comma-separated extra trusted origins for better-auth (CORS / redirects). */
  TRUSTED_ORIGINS?: string;
  /** Dev-only: set to "true" in .dev.vars to bypass the origin check on this machine. */
  DISABLE_ORIGIN_CHECK?: string;
}

export const DEFAULT_VTOP_LOGIN_URL = "https://api.amazecc.com/api/login";
