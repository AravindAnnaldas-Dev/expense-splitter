import "express-async-errors"; // patches Express to forward rejected promises from async handlers to the error middleware below
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import groupRoutes from "./routes/groups";
import expenseRoutes from "./routes/expenses";

export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

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
