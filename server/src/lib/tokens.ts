import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { Response } from "express";
import { prisma } from "./prisma";

// Single source of truth for the access token's lifetime, expressed once
// in ms (used for the cookie's maxAge) and derived from that for the JWT's
// own expiresIn — so the cookie can never outlive (or expire before) the
// token it's carrying.
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

// Cross-site cookies (the deployed client and server live on different
// domains — Vercel and Railway) require SameSite=None, which browsers only
// honor alongside Secure. Locally, client and server are both "localhost"
// (same site, different port), so SameSite=Lax + non-Secure works over
// plain http — and Secure cookies are simply never sent over plain http at
// all, so getting this wrong locally silently breaks every login.
//
// This is deliberately its own variable rather than keying off NODE_ENV:
// on some machines NODE_ENV is set to "production" globally as an ambient
// shell variable unrelated to this project (e.g. by some other tool), which
// would otherwise flip cookies into Secure+SameSite=None mode during local
// `npm run dev` over http — and browsers would then silently refuse to send
// them, breaking every login with no obvious error. Set COOKIE_SECURE=true
// explicitly on the deployed server (see .env.example); leave it unset
// locally.
const isProd = process.env.COOKIE_SECURE === "true";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

function signAccessToken(userId: string): string {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, options);
}

function hashToken(token: string): string {
  // Refresh tokens are already high-entropy random values (not
  // user-chosen secrets like passwords), so a fast cryptographic hash is
  // appropriate here — unlike bcrypt for passwords, we don't need
  // deliberate slowness against brute-forcing a low-entropy input.
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh access + refresh token pair for a user, persists the
 * refresh token's hash (so it can be looked up and revoked later), and
 * sets both as httpOnly cookies on the response. Used by register, login,
 * and refresh.
 */
export async function issueTokens(userId: string, res: Response) {
  const accessToken = signAccessToken(userId);

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
  });

  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: ACCESS_TOKEN_TTL_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
}

/**
 * Validates a refresh token cookie against the stored hash, rotates it
 * (deletes the old row, issues a new pair), and sets fresh cookies.
 * Rotation means a stolen refresh token only works once before the
 * legitimate user's next refresh invalidates it — if both ever try to use
 * the same token, only the first succeeds.
 */
export async function rotateRefreshToken(refreshToken: string, res: Response): Promise<boolean> {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    return false;
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  await issueTokens(stored.userId, res);
  return true;
}

export async function revokeRefreshToken(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

export const cookieNames = { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE };
