import express from "express";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createApp } from "./app";
import { makeAdvisor } from "./ai";
import { createDatabase } from "./db";

const production = process.env.NODE_ENV === "production";
const username = process.env.DEMO_USERNAME || (!production ? "officer" : "");
const password =
  process.env.DEMO_PASSWORD || (!production ? "local-demo-only" : "");
if (!username || !password || (production && password.length < 12))
  throw new Error(
    "Set DEMO_USERNAME and a DEMO_PASSWORD of at least 12 characters.",
  );
const dataDir = resolve(process.env.DATA_DIR || "./data");
mkdirSync(dataDir, { recursive: true });
const db = createDatabase(join(dataDir, "civic-desk.sqlite"));
const app = createApp(db, {
  username,
  password,
  production,
  advisor: makeAdvisor(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL),
});
if (production) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
const port = Number(process.env.PORT || 3001);
app.listen(port, production ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(`Civic Desk running at http://localhost:${port}`),
);
