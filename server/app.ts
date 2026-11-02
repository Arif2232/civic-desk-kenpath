import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  applyAction,
  createComplaint,
  getComplaint,
  listComplaints,
  WorkflowError,
} from "./db";
import type { Advisor } from "./ai";

type Config = {
  username: string;
  password: string;
  production: boolean;
  advisor: Advisor;
};
const equal = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
const cookieToken = (header = "") =>
  header
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("civic_session="))
    ?.slice("civic_session=".length);

export function createApp(db: DatabaseSync, config: Config) {
  const app = express();
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; until: number }>();
  const adviceLimits = new Map<string, { count: number; until: number }>();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.production,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (origin && !["GET", "HEAD"].includes(req.method)) {
      try {
        const allowed =
          new URL(origin).host === req.get("host") ||
          (!config.production && origin === "http://localhost:5173");
        if (!allowed)
          return res.status(403).json({ error: "Origin not allowed." });
      } catch {
        return res.status(403).json({ error: "Origin not allowed." });
      }
    }
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/session", (req, res) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const prior = attempts.get(ip);
    const state =
      prior && prior.until > now
        ? prior
        : { count: 0, until: now + 15 * 60_000 };
    if (state.count >= 8)
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again later." });
    if (
      typeof req.body?.username !== "string" ||
      typeof req.body?.password !== "string" ||
      !equal(req.body.username, config.username) ||
      !equal(req.body.password, config.password)
    ) {
      state.count++;
      attempts.set(ip, state);
      return res.status(401).json({ error: "Incorrect demo credentials." });
    }
    attempts.delete(ip);
    const token = randomBytes(32).toString("hex");
    sessions.set(token, now + cookieOptions.maxAge);
    res.cookie("civic_session", token, cookieOptions).json({ ok: true });
  });
  app.use("/api", (req, res, next) => {
    const token = cookieToken(req.headers.cookie);
    const expires = token && sessions.get(token);
    if (!token || !expires || expires <= Date.now()) {
      if (token) sessions.delete(token);
      return res.status(401).json({ error: "Sign in to continue." });
    }
    next();
  });
  app.get("/api/session", (_req, res) => res.json({ ok: true }));
  app.delete("/api/session", (req, res) => {
    const token = cookieToken(req.headers.cookie);
    if (token) sessions.delete(token);
    res.clearCookie("civic_session", cookieOptions).json({ ok: true });
  });
  app.get("/api/complaints", (_req, res) => res.json(listComplaints(db)));
  app.get("/api/complaints/:id", (req, res, next) => {
    try {
      res.json(getComplaint(db, req.params.id));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/complaints", (req, res, next) => {
    try {
      res.status(201).json(createComplaint(db, req.body));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/complaints/:id/actions", (req, res, next) => {
    try {
      res.json(
        applyAction(
          db,
          req.params.id,
          req.body?.action,
          req.body?.note,
          req.body?.version,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/complaints/:id/advice", async (req, res, next) => {
    try {
      if (!["en", "hi"].includes(req.body?.language))
        throw new WorkflowError("Choose English or Hindi.");
      const ip = req.ip || "unknown";
      const now = Date.now();
      const previous = adviceLimits.get(ip);
      const limit =
        previous && previous.until > now
          ? previous
          : { count: 0, until: now + 60 * 60_000 };
      if (limit.count >= 20)
        throw new WorkflowError(
          "Suggestion limit reached. Try again later.",
          429,
        );
      limit.count++;
      adviceLimits.set(ip, limit);
      const { complaint, events } = getComplaint(db, req.params.id);
      res.json(await config.advisor(complaint, events, req.body.language));
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof WorkflowError)
      return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: "Invalid request." });
    console.error("Request failed:", error.name);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  });
  return app;
}
