import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// TOKEN FLOW:
// 1. On register/login, the server signs a JWT whose payload is just
//    { userId }. The token is handed back to the client in the JSON body.
// 2. The client stores it (see client/src/lib/auth.ts) and attaches it to
//    every subsequent request as `Authorization: Bearer <token>`.
// 3. This middleware runs before any protected route handler. It reads the
//    header, verifies the signature and expiry using the same JWT_SECRET
//    the server signed with, and — if valid — attaches `req.userId` so
//    downstream handlers know who's asking without re-deriving it.
// 4. Any failure (missing header, malformed token, bad signature, expired
//    token) results in a 401 rather than letting the request through. We
//    never trust a userId that arrives in the request body — the identity
//    always comes from the verified token.

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);

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
