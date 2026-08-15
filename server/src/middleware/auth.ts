import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { cookieNames } from "../lib/tokens";

// TOKEN FLOW:
// 1. On register/login, the server signs a short-lived (15m) access-token
//    JWT and a separate long-lived (30d) opaque refresh token, and sets
//    both as httpOnly cookies (see src/lib/tokens.ts) — never returned in
//    the response body, so client-side JS never touches them directly.
//    The browser attaches cookies automatically on every same-site or
//    (with credentials: 'include') cross-site request.
// 2. This middleware reads the access-token cookie, verifies its signature
//    and expiry against JWT_SECRET, and attaches `req.userId` so route
//    handlers know who's asking without re-deriving it.
// 3. When the access token has expired, the client calls
//    POST /api/auth/refresh (using the still-valid refresh-token cookie)
//    to get a fresh pair, then retries the original request — see
//    client/src/lib/api.ts for that retry logic.
// 4. Any failure (missing cookie, tampered/expired token) results in a 401
//    rather than letting the request through. We never trust a userId that
//    arrives in the request body — identity always comes from the
//    verified token.

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[cookieNames.access];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    // Covers both expired tokens (TokenExpiredError) and tampered/invalid
    // signatures (JsonWebTokenError) — both are just "not authenticated".
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
