import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { Complaint, Event, Priority } from "./workflow";
import { nextStage } from "./workflow";

export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const seeds = [
  {
    title_en: "Waste near the community market",
    title_hi: "सामुदायिक बाजार के पास कचरा",
    description_en:
      "Household waste has accumulated near the community market entrance. The footpath is partially blocked.",
    description_hi:
      "सामुदायिक बाजार के प्रवेश द्वार के पास घरेलू कचरा जमा है। फुटपाथ का कुछ हिस्सा बाधित है।",
    locality: "Karol Bagh · Ward 84",
    priority: "high",
    stage: "received",
    hours: 27,
  },
  {
    title_en: "Collection missed on residential lane",
    title_hi: "आवासीय गली में कचरा नहीं उठा",
    description_en:
      "The shared collection point on the lane was missed. Please check the next collection round.",
    description_hi:
      "गली के साझा संग्रह बिंदु से कचरा नहीं उठाया गया। कृपया अगला संग्रह चक्र जाँचें।",
    locality: "Rohini · Ward 52",
    priority: "normal",
    stage: "assigned",
    hours: 21,
  },
  {
    title_en: "Overflowing public waste bin",
    title_hi: "सार्वजनिक कूड़ेदान भर गया है",
    description_en:
      "A public bin near the bus stop is overflowing. Waste has spread around the bin.",
    description_hi:
      "बस स्टॉप के पास सार्वजनिक कूड़ेदान भर गया है और आसपास कचरा फैल गया है।",
    locality: "Shahdara · Ward 221",
    priority: "high",
    stage: "review",
    hours: 18,
  },
  {
    title_en: "Waste left beside park entrance",
    title_hi: "पार्क के प्रवेश द्वार पर कचरा",
    description_en:
      "Bags of mixed waste have been left beside the park entrance since the morning.",
    description_hi:
      "सुबह से पार्क के प्रवेश द्वार के पास मिश्रित कचरे की थैलियाँ रखी हैं।",
    locality: "Dwarka · Ward 133",
    priority: "normal",
    stage: "received",
    hours: 7,
  },
  {
    title_en: "Collection point needs clarification",
    title_hi: "संग्रह बिंदु की जानकारी चाहिए",
    description_en:
      "A report mentions missed collection, but the collection point was not specified.",
    description_hi:
      "शिकायत में कचरा न उठने की बात है, लेकिन संग्रह बिंदु की जानकारी नहीं दी गई है।",
    locality: "Civil Lines · Ward 71",
    priority: "normal",
    stage: "returned",
    hours: 32,
  },
  {
    title_en: "Litter near a shared collection point",
    title_hi: "साझा संग्रह बिंदु के पास कचरा",
    description_en:
      "Waste was reported around a shared collection point. The field team recorded a clean-up.",
    description_hi:
      "साझा संग्रह बिंदु के आसपास कचरे की शिकायत थी। फील्ड टीम ने सफाई की जानकारी दर्ज की।",
    locality: "Najafgarh · Ward 125",
    priority: "normal",
    stage: "resolved",
    hours: 48,
  },
] as const;

export function createDatabase(filename: string): DatabaseSync {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY, title_en TEXT NOT NULL, title_hi TEXT NOT NULL,
      description_en TEXT NOT NULL, description_hi TEXT NOT NULL,
      locality TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('normal','high')),
      stage TEXT NOT NULL CHECK(stage IN ('received','assigned','review','returned','resolved','rejected')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, complaint_id TEXT NOT NULL REFERENCES complaints(id),
      action TEXT NOT NULL, from_stage TEXT, to_stage TEXT NOT NULL, note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_case ON events(complaint_id, id);`);
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM complaints")
    .get() as { count: number };
  if (count.count === 0) {
    const now = Date.now();
    const insert = db.prepare(
      "INSERT INTO complaints VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
    );
    const event = db.prepare(
      "INSERT INTO events (complaint_id,action,from_stage,to_stage,note,created_at) VALUES (?,?,?,?,?,?)",
    );
    db.exec("BEGIN");
    try {
      seeds.forEach((s, i) => {
        const id = `CD-26-${String(1041 - i).padStart(4, "0")}`;
        const created = new Date(now - s.hours * 3600000).toISOString();
        insert.run(
          id,
          s.title_en,
          s.title_hi,
          s.description_en,
          s.description_hi,
          s.locality,
          s.priority,
          s.stage,
          created,
          created,
        );
        event.run(id, "created", null, "received", "", created);
        if (s.stage !== "received")
          event.run(
            id,
            "seeded",
            "received",
            s.stage,
            "",
            new Date(now - (s.hours - 1) * 3600000).toISOString(),
          );
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return db;
}

export function listComplaints(db: DatabaseSync): Complaint[] {
  return db
    .prepare(
      `SELECT * FROM complaints ORDER BY
    CASE WHEN stage IN ('resolved','rejected') THEN 1 ELSE 0 END,
    CASE priority WHEN 'high' THEN 0 ELSE 1 END, created_at ASC`,
    )
    .all() as Complaint[];
}

export function getComplaint(
  db: DatabaseSync,
  id: string,
): { complaint: Complaint; events: Event[] } {
  const complaint = db
    .prepare("SELECT * FROM complaints WHERE id=?")
    .get(id) as Complaint | undefined;
  if (!complaint) throw new WorkflowError("Complaint not found", 404);
  const events = db
    .prepare("SELECT * FROM events WHERE complaint_id=? ORDER BY id DESC")
    .all(id) as Event[];
  return { complaint, events };
}

export function createComplaint(
  db: DatabaseSync,
  input: {
    title: string;
    description: string;
    locality: string;
    priority: Priority;
  },
): Complaint {
  const clean = (s: unknown, max: number) =>
    typeof s === "string" && s.trim().length >= 3 && s.trim().length <= max;
  if (
    !input ||
    !clean(input.title, 100) ||
    !clean(input.description, 1000) ||
    !clean(input.locality, 100) ||
    !["normal", "high"].includes(input.priority)
  ) {
    throw new WorkflowError(
      "Please enter a title, description and locality (3–1000 characters).",
    );
  }
  const id = `CD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    // shortcut: new entries keep their original language; add vetted translations before public use.
    db.prepare(
      "INSERT INTO complaints VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
    ).run(
      id,
      input.title.trim(),
      input.title.trim(),
      input.description.trim(),
      input.description.trim(),
      input.locality.trim(),
      input.priority,
      "received",
      now,
      now,
    );
    db.prepare(
      "INSERT INTO events (complaint_id,action,from_stage,to_stage,note,created_at) VALUES (?,?,?,?,?,?)",
    ).run(id, "created", null, "received", "", now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getComplaint(db, id).complaint;
}

export function applyAction(
  db: DatabaseSync,
  id: string,
  action: string,
  note: string,
  version: number,
): Complaint {
  if (
    typeof note !== "string" ||
    note.trim().length < 3 ||
    note.trim().length > 1000 ||
    !Number.isInteger(version)
  ) {
    throw new WorkflowError(
      "Add a short reason or work note (3–1000 characters).",
    );
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const { complaint } = getComplaint(db, id);
    if (complaint.version !== version)
      throw new WorkflowError(
        "This case changed. Refresh and review it again.",
        409,
      );
    const next = nextStage(complaint.stage, action);
    if (!next)
      throw new WorkflowError(
        "This action is not available in the current stage.",
        409,
      );
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE complaints SET stage=?, updated_at=?, version=version+1 WHERE id=?",
    ).run(next, now, id);
    db.prepare(
      "INSERT INTO events (complaint_id,action,from_stage,to_stage,note,created_at) VALUES (?,?,?,?,?,?)",
    ).run(id, action, complaint.stage, next, note.trim(), now);
    db.exec("COMMIT");
    return getComplaint(db, id).complaint;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
