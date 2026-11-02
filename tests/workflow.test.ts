import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app";
import { makeAdvisor } from "../server/ai";
import { createDatabase, getComplaint } from "../server/db";

test("authenticated officer controls the workflow; suggestions cannot mutate it", async () => {
  const db = createDatabase(":memory:");
  const stages: string[] = [];
  const app = createApp(db, {
    username: "officer",
    password: "test-password",
    production: false,
    advisor: async (complaint) => {
      stages.push(complaint.stage);
      return { text: "Check the location.", mode: "ai" };
    },
  });
  const server = app.listen(0);
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie?: string,
    origin?: string,
  ) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await request("/complaints")).status, 401);
    assert.equal(
      (
        await request("/session", "POST", {
          username: "officer",
          password: "wrong",
        })
      ).status,
      401,
    );
    const login = await request("/session", "POST", {
      username: "officer",
      password: "test-password",
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const all = (await (
      await request("/complaints", "GET", undefined, cookie)
    ).json()) as Array<{ id: string; stage: string; version: number }>;
    const initial = all.find((c) => c.stage === "received")!;
    assert.ok(initial);
    const before = getComplaint(db, initial.id);
    const suggestion = await request(
      `/complaints/${initial.id}/advice`,
      "POST",
      { language: "hi" },
      cookie,
    );
    assert.equal(suggestion.status, 200);
    assert.equal(((await suggestion.json()) as { mode: string }).mode, "ai");
    assert.deepEqual(getComplaint(db, initial.id), before);
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/actions`,
          "POST",
          { action: "assign", note: "", version: initial.version },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/actions`,
          "POST",
          {
            action: "__proto__",
            note: "Invalid action",
            version: initial.version,
          },
          cookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/actions`,
          "POST",
          {
            action: "assign",
            note: "Assign for field check",
            version: initial.version,
          },
          cookie,
          "https://unrelated.example",
        )
      ).status,
      403,
    );
    const assign = await request(
      `/complaints/${initial.id}/actions`,
      "POST",
      {
        action: "assign",
        note: "Assign for field check",
        version: initial.version,
      },
      cookie,
    );
    assert.equal(
      ((await assign.json()) as { stage: string }).stage,
      "assigned",
    );
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/advice`,
          "POST",
          { language: "en" },
          cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/actions`,
          "POST",
          {
            action: "submit_review",
            note: "Work recorded",
            version: initial.version,
          },
          cookie,
        )
      ).status,
      409,
    );
    const review = await request(
      `/complaints/${initial.id}/actions`,
      "POST",
      {
        action: "submit_review",
        note: "Field work recorded for review",
        version: initial.version + 1,
      },
      cookie,
    );
    assert.equal(((await review.json()) as { stage: string }).stage, "review");
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/advice`,
          "POST",
          { language: "en" },
          cookie,
        )
      ).status,
      200,
    );
    assert.deepEqual(stages, ["received", "assigned", "review"]);
    const approve = await request(
      `/complaints/${initial.id}/actions`,
      "POST",
      {
        action: "approve",
        note: "Reviewed the recorded update",
        version: initial.version + 2,
      },
      cookie,
    );
    assert.equal(
      ((await approve.json()) as { stage: string }).stage,
      "resolved",
    );
    const final = getComplaint(db, initial.id);
    assert.deepEqual(
      final.events.slice(0, 3).map((e) => e.action),
      ["approve", "submit_review", "assign"],
    );
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/actions`,
          "POST",
          {
            action: "assign",
            note: "Reassign again",
            version: initial.version + 3,
          },
          cookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (await request("/complaints", "POST", {}, cookie)).status,
      400,
    );
    const made = await request(
      "/complaints",
      "POST",
      {
        title: "Demo report",
        description: "Fictional waste report",
        locality: "Demo ward",
        priority: "normal",
      },
      cookie,
    );
    assert.equal(made.status, 201);
    assert.equal(((await made.json()) as { stage: string }).stage, "received");
    for (let i = 0; i < 17; i++)
      assert.equal(
        (
          await request(
            `/complaints/${initial.id}/advice`,
            "POST",
            { language: "en" },
            cookie,
          )
        ).status,
        200,
      );
    assert.equal(
      (
        await request(
          `/complaints/${initial.id}/advice`,
          "POST",
          { language: "en" },
          cookie,
        )
      ).status,
      429,
    );
    assert.equal(
      (await request("/session", "DELETE", undefined, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/complaints", "GET", undefined, cookie)).status,
      401,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});

test("unconfigured assistance is clearly a non-AI preview in both languages", async () => {
  const db = createDatabase(":memory:");
  const { complaint, events } = getComplaint(db, "CD-26-1041");
  const advisor = makeAdvisor();
  const en = await advisor(complaint, events, "en");
  const hi = await advisor(complaint, events, "hi");
  assert.equal(en.mode, "preview");
  assert.equal(hi.mode, "preview");
  assert.notEqual(en.text, hi.text);
  db.close();
});
