import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { z } from "zod";
import { DEFAULT_VTOP_LOGIN_URL, type AuthEnv } from "../env";

/**
 * VTOP account linking.
 *
 * Amaze ID exists without VTOP. Students who want their VTOP identity attached
 * prove ownership once: we POST their VTOP credentials to the scraper service
 * (api.amazecc.com/api/login by default), which answers whether VTOP accepts
 * them. On success we link `account { providerId: "vtop", accountId: <authorizedID> }`
 * to the signed-in user and mirror the reg number onto `user.vtopRegNo`.
 *
 * The VTOP password is used for that single verification call and is never
 * stored, logged, or returned. Unlinking removes the account row and clears
 * the reg number. A reg number can be linked to exactly one Amaze ID.
 */
async function verifyVtopCredentials(
  env: AuthEnv,
  username: string,
  password: string
): Promise<{ authorizedID: string } | { error: string }> {
  const url = env.VTOP_LOGIN_URL || DEFAULT_VTOP_LOGIN_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "amazecc-auth/vtop-link",
        ...(env.VTOP_SERVICE_SECRET ? { "x-service-secret": env.VTOP_SERVICE_SECRET } : {}),
      },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    // The scraper answers 200 + { success: true, authorizedID } or an error status.
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body || body.success !== true) {
      const message =
        typeof body?.message === "string" ? body.message
        : typeof body?.error === "string" ? body.error
        : "VTOP rejected the credentials";
      return { error: message };
    }
    const authorizedID =
      (typeof body.authorizedID === "string" && body.authorizedID.trim()) ||
      username.toUpperCase().trim();
    return { authorizedID: authorizedID.toUpperCase() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "VTOP did not respond in time. Please try again." };
    }
    return { error: "Could not reach the VTOP verification service." };
  } finally {
    clearTimeout(timer);
  }
}

export const vtopLink = (env: AuthEnv) => ({
  id: "amaze-vtop-link",
  endpoints: {
    linkVtop: createAuthEndpoint(
      "/vtop/link",
      {
        method: "POST",
        requireHeaders: true,
        body: z.object({
          username: z.string().trim().min(1).max(64),
          password: z.string().min(1).max(256),
        }),
      },
      async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError("UNAUTHORIZED");

        const { username, password } = ctx.body;
        const verified = await verifyVtopCredentials(env, username, password);
        if ("error" in verified) {
          throw new APIError("BAD_REQUEST", { message: verified.error });
        }
        const authorizedID = verified.authorizedID;

        // One VTOP identity per Amaze ID.
        const existing = await ctx.context.internalAdapter.findAccountByKey({
          providerId: "vtop",
          accountId: authorizedID,
        });
        if (existing && existing.userId !== session.user.id) {
          throw new APIError("CONFLICT", { message: "This VTOP account is already linked to a different Amaze ID." });
        }

        if (existing) {
          await ctx.context.internalAdapter.updateUser(session.user.id, { vtopRegNo: authorizedID });
          return { success: true, linked: true, vtopRegNo: authorizedID, alreadyLinked: true };
        }

        await ctx.context.internalAdapter.createAccount({
          userId: session.user.id,
          providerId: "vtop",
          accountId: authorizedID,
        });
        await ctx.context.internalAdapter.updateUser(session.user.id, { vtopRegNo: authorizedID });
        return { success: true, linked: true, vtopRegNo: authorizedID, alreadyLinked: false };
      }
    ),

    unlinkVtop: createAuthEndpoint(
      "/vtop/link",
      { method: "DELETE", requireHeaders: true },
      async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError("UNAUTHORIZED");

        const accounts = await ctx.context.internalAdapter.findAccounts(session.user.id);
        const vtopAccount = accounts.find((a: { providerId: string }) => a.providerId === "vtop");
        if (vtopAccount) await ctx.context.internalAdapter.deleteAccount(vtopAccount.id);
        await ctx.context.internalAdapter.updateUser(session.user.id, { vtopRegNo: null });
        return { success: true, unlinked: Boolean(vtopAccount) };
      }
    ),

    vtopLinkStatus: createAuthEndpoint(
      "/vtop/link",
      { method: "GET", requireHeaders: true },
      async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError("UNAUTHORIZED");
        const accounts = await ctx.context.internalAdapter.findAccounts(session.user.id);
        const vtopAccount = accounts.find((a: { providerId: string }) => a.providerId === "vtop");
        return {
          linked: Boolean(vtopAccount),
          vtopRegNo: vtopAccount?.accountId ?? null,
        };
      }
    ),
  },
});
