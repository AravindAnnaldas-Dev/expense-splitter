import { Router } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { issueTokens, rotateRefreshToken, revokeRefreshToken, clearAuthCookies, cookieNames } from "../lib/tokens";

const router = Router();

const SALT_ROUNDS = 10;

// Without this, /login is brute-forceable: an attacker can try passwords
// as fast as the network allows, since bcrypt.compare failing costs them
// nothing but a request. Capping attempts per IP makes that impractical
// without meaningfully affecting a real user who mistypes their password
// a few times. Scoped to login/register only — the rest of the API is
// already gated by requireAuth, which has its own cost (a valid JWT).
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/register", authRateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  // Never store the plaintext password — only the bcrypt hash. bcrypt bakes
  // a random salt into the hash itself, so two users with the same password
  // still get different hashes.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true },
  });

  await issueTokens(user.id, res);
  res.status(201).json({ user });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", authRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for "no such user" and "wrong password" — being specific
  // here would let an attacker enumerate registered emails.
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  await issueTokens(user.id, res);
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// Exchanges a still-valid refresh-token cookie for a fresh access/refresh
// pair, without requiring the user to re-enter credentials. The client
// calls this transparently when a request comes back 401 because the
// short-lived access token expired (see client/src/lib/api.ts).
router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[cookieNames.refresh];
  if (!refreshToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const ok = await rotateRefreshToken(refreshToken, res);
  if (!ok) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Session expired, please log in again" });
  }

  res.json({ ok: true });
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[cookieNames.refresh];
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  clearAuthCookies(res);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

export default router;
