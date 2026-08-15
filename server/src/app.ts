import "express-async-errors"; // patches Express to forward rejected promises from async handlers to the error middleware below
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import groupRoutes from "./routes/groups";
import expenseRoutes from "./routes/expenses";

export const app = express();

// Behind Railway's (or any reverse proxy's) load balancer, req.ip would
// otherwise resolve to the proxy's address for every request — collapsing
// every user into one IP and making express-rate-limit (see routes/auth.ts)
// rate-limit all users together instead of individually.
app.set("trust proxy", 1);

// credentials: true is required for the browser to send/accept the
// httpOnly auth cookies cross-site; it only works paired with a specific
// origin (never "*"), which we already have via CLIENT_ORIGIN.
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler: anything an async route handler throws (e.g.
// a Prisma error) lands here instead of crashing the process or hanging
// the request.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
