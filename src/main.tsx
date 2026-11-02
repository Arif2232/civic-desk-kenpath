import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  Languages,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { copy, type Language } from "./i18n";
import type {
  Action,
  Complaint,
  Event,
  Priority,
  Stage,
} from "../server/workflow";
import { transitions } from "../server/workflow";
import "./style.css";

type Detail = { complaint: Complaint; events: Event[] };
type Filter = "all" | "open" | "review" | "closed";
type Advice = { text: string; mode: "ai" | "preview" };
type Text = typeof copy.en;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const e = new Error("Request failed") as Error & { status: number };
    e.status = response.status;
    throw e;
  }
  return response.json();
}

function label(t: Text, stage: Stage) {
  return {
    received: t.received,
    assigned: t.assigned,
    review: t.review,
    returned: t.returned,
    resolved: t.done,
    rejected: t.rejected,
  }[stage];
}
function stageHelp(t: Text, stage: Stage) {
  return {
    received: t.stageReceived,
    assigned: t.stageAssigned,
    review: t.stageReview,
    returned: t.stageReturned,
    resolved: t.stageResolved,
    rejected: t.stageRejected,
  }[stage];
}
function eventName(t: Text, action: string) {
  const labels: Record<string, string> = {
    created: t.createdEvent,
    seeded: t.seededEvent,
    assign: t.assignEvent,
    submit_review: t.submit_reviewEvent,
    approve: t.approveEvent,
    return: t.returnEvent,
    reject: t.rejectEvent,
    resume: t.resumeEvent,
  };
  return labels[action] || action;
}
function displayDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function age(value: string, language: Language) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000),
  );
  return language === "hi" ? `${hours} घंटे पहले` : `${hours}h ago`;
}
function place(value: string, language: Language) {
  const names: Record<string, string> = {
    "Karol Bagh · Ward 84": "करोल बाग · वार्ड 84",
    "Rohini · Ward 52": "रोहिणी · वार्ड 52",
    "Shahdara · Ward 221": "शाहदरा · वार्ड 221",
    "Dwarka · Ward 133": "द्वारका · वार्ड 133",
    "Civil Lines · Ward 71": "सिविल लाइन्स · वार्ड 71",
    "Najafgarh · Ward 125": "नजफगढ़ · वार्ड 125",
  };
  return language === "hi" ? names[value] || value : value;
}

function LocaleToggle({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (l: Language) => void;
}) {
  return (
    <div className="language" aria-label="Language">
      <Languages size={15} aria-hidden="true" />
      <button
        type="button"
        className={language === "en" ? "chosen" : ""}
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
      >
        EN
      </button>
      <button
        type="button"
        lang="hi"
        className={language === "hi" ? "chosen" : ""}
        onClick={() => setLanguage("hi")}
        aria-pressed={language === "hi"}
      >
        हिं
      </button>
    </div>
  );
}

function Login({
  language,
  setLanguage,
  onLogin,
}: {
  language: Language;
  setLanguage: (l: Language) => void;
  onLogin: () => void;
}) {
  const t = copy[language];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await api("/session", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <section className="login-story">
        <Brand light t={t} />
        <div className="login-story-content">
          <span className="overline light-overline">{t.loginEyebrow}</span>
          <h1>{t.loginTitle}</h1>
          <p>{t.loginText}</p>
          <div className="login-features">
            {[t.loginFact1, t.loginFact2, t.loginFact3].map((x) => (
              <div key={x}>
                <Check size={16} />
                {x}
              </div>
            ))}
          </div>
        </div>
        <div className="login-deco" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <small>{t.demoNotice}</small>
      </section>
      <section className="login-panel">
        <div className="login-top">
          <LocaleToggle language={language} setLanguage={setLanguage} />
        </div>
        <div className="login-form-wrap">
          <span className="section-icon">
            <ShieldCheck size={22} />
          </span>
          <h2>{t.login}</h2>
          <p>{t.loginHelp}</p>
          <form onSubmit={submit} className="login-form">
            <label>
              {t.username}
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              {t.password}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {t.loginError}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? t.loginLoading : t.loginButton}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="login-foot">
            <ShieldCheck size={15} />
            {t.demoNotice}
          </div>
        </div>
      </section>
    </div>
  );
}

function Brand({ t, light = false }: { t: Text; light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <div className="brand-mark">
        <span>✳</span>
      </div>
      <div>
        <strong>{t.brand}</strong>
        <small>{t.brandSub}</small>
      </div>
    </div>
  );
}

function NewComplaint({
  t,
  onClose,
  onCreated,
}: {
  t: Text;
  onClose: () => void;
  onCreated: (c: Complaint) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locality, setLocality] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      onCreated(
        await api<Complaint>("/complaints", {
          method: "POST",
          body: JSON.stringify({ title, description, locality, priority }),
        }),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  function keyboard(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") onClose();
    if (e.key !== "Tab") return;
    const items = [
      ...e.currentTarget.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)",
      ),
    ];
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      items.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
      e.preventDefault();
      items[0]?.focus();
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-title"
        onKeyDown={keyboard}
      >
        <div className="modal-head">
          <div>
            <span className="overline">{t.sampleTag}</span>
            <h2 id="new-title">{t.newTitle}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={t.close}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <p>{t.newHelp}</p>
        <form onSubmit={submit} className="new-form">
          <label>
            {t.titleLabel}
            <input
              autoFocus
              value={title}
              minLength={3}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label>
            {t.detailsLabel}
            <textarea
              value={description}
              minLength={3}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
          <label>
            {t.locationLabel}
            <input
              value={locality}
              minLength={3}
              maxLength={100}
              onChange={(e) => setLocality(e.target.value)}
              required
            />
          </label>
          <label>
            {t.priorityLabel}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="normal">{t.normal}</option>
              <option value="high">{t.high}</option>
            </select>
          </label>
          {error && (
            <p className="error" role="alert">
              {t.genericError}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              {t.cancel}
            </button>
            <button className="primary" disabled={busy}>
              {busy ? t.saving : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Workspace({
  language,
  setLanguage,
  onLogout,
}: {
  language: Language;
  setLanguage: (l: Language) => void;
  onLogout: () => void;
}) {
  const t = copy[language];
  const [cases, setCases] = useState<Complaint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [advising, setAdvising] = useState(false);
  const [adding, setAdding] = useState(false);
  const adviceRequest = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  function closeModal() {
    setAdding(false);
    requestAnimationFrame(() => addRef.current?.focus());
  }

  async function loadCases(preferred?: string) {
    try {
      const items = await api<Complaint[]>("/complaints");
      setCases(items);
      setSelected(
        (old) =>
          preferred ||
          (old && items.some((c) => c.id === old) ? old : items[0]?.id || null),
      );
      setError("");
    } catch (e) {
      if ((e as { status?: number }).status === 401) onLogout();
      else setError(t.genericError);
    } finally {
      setLoading(false);
    }
  }
  async function loadDetail(id: string) {
    try {
      setDetail(await api<Detail>(`/complaints/${encodeURIComponent(id)}`));
    } catch {
      setError(t.genericError);
    }
  }
  useEffect(() => {
    void loadCases();
  }, []);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setNote("");
    setAdvice(null);
    setError("");
    if (selected)
      api<Detail>(`/complaints/${encodeURIComponent(selected)}`)
        .then((data) => {
          if (active) setDetail(data);
        })
        .catch(() => {
          if (active) setError(t.genericError);
        });
    return () => {
      active = false;
    };
  }, [selected]);
  useEffect(() => {
    adviceRequest.current?.abort();
    setAdvising(false);
    setAdvice(null);
    document.documentElement.lang = language;
    return () => adviceRequest.current?.abort();
  }, [language, selected]);
  const activeCases = cases.filter(
    (c) => !["resolved", "rejected"].includes(c.stage),
  );
  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        const matchFilter =
          filter === "all" ||
          (filter === "open" && !["resolved", "rejected"].includes(c.stage)) ||
          (filter === "review" && c.stage === "review") ||
          (filter === "closed" && ["resolved", "rejected"].includes(c.stage));
        return (
          matchFilter &&
          `${c.id} ${c.locality} ${place(c.locality, "hi")} ${c.title_en} ${c.title_hi}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        );
      }),
    [cases, filter, query],
  );
  async function submitAction(action: Action) {
    if (!detail || note.trim().length < 3) {
      setError(t.noteRequired);
      return;
    }
    adviceRequest.current?.abort();
    setAdvising(false);
    setAdvice(null);
    const id = detail.complaint.id;
    setBusy(true);
    setError("");
    try {
      await api(`/complaints/${encodeURIComponent(id)}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action,
          note,
          version: detail.complaint.version,
        }),
      });
      setNote("");
      setAdvice(null);
      await Promise.all([loadCases(id), loadDetail(id)]);
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        await Promise.all([loadCases(id), loadDetail(id)]);
        setError(t.stale);
      } else setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }
  async function askAdvice() {
    if (!detail) return;
    const controller = new AbortController();
    adviceRequest.current = controller;
    setAdvising(true);
    setAdvice(null);
    try {
      const result = await api<Advice>(
        `/complaints/${encodeURIComponent(detail.complaint.id)}/advice`,
        {
          method: "POST",
          body: JSON.stringify({ language }),
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) setAdvice(result);
    } catch {
      if (!controller.signal.aborted) setError(t.aiError);
    } finally {
      if (adviceRequest.current === controller) setAdvising(false);
    }
  }
  async function logout() {
    try {
      await api("/session", { method: "DELETE" });
    } finally {
      onLogout();
    }
  }
  const current = detail?.complaint;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand t={t} />
        <div className="side-label">{t.demo}</div>
        <div className="side-nav active-nav">
          <LayoutGrid size={17} />
          <span>{t.workQueue}</span>
          <ChevronRight size={15} />
        </div>
        <div className="sidebar-bottom">
          <div className="side-note">
            <ShieldCheck size={18} />
            <span>{t.demoNotice}</span>
          </div>
          <div className="side-footer">
            {t.guidance}
            <ArrowUpRight size={14} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand t={t} />
          </div>
          <div className="breadcrumb">
            <span>{t.overview}</span>
            <ChevronRight size={14} />
            <strong>{t.workQueue}</strong>
          </div>
          <div className="top-actions">
            <LocaleToggle language={language} setLanguage={setLanguage} />
            <div className="officer">
              <div className="avatar">O</div>
              <div>
                <strong>{t.officer}</strong>
                <small>{t.demo}</small>
              </div>
            </div>
            <button
              className="icon-button logout"
              aria-label={t.signOut}
              title={t.signOut}
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <div className="main-content">
          <div className="hero">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                {t.eyebrow}
              </div>
              <h1>{t.heading}</h1>
              <p>{t.subheading}</p>
            </div>
            <button
              ref={addRef}
              className="primary add"
              disabled={busy}
              onClick={() => setAdding(true)}
            >
              <Plus size={18} />
              {t.add}
            </button>
          </div>
          <div className="demo-banner">
            <CircleAlert size={16} />
            <span>{t.demoNotice}</span>
          </div>
          <section className="metrics" aria-label={t.overview}>
            {[
              {
                title: t.active,
                value: activeCases.length,
                icon: ClipboardList,
                tone: "blue",
              },
              {
                title: t.urgent,
                value: activeCases.filter((c) => c.priority === "high").length,
                icon: CircleAlert,
                tone: "orange",
              },
              {
                title: t.needsReview,
                value: cases.filter((c) => c.stage === "review").length,
                icon: Clock3,
                tone: "violet",
              },
              {
                title: t.resolved,
                value: cases.filter((c) => c.stage === "resolved").length,
                icon: CheckCircle2,
                tone: "green",
              },
            ].map(({ title, value, icon: Icon, tone }) => (
              <div className="metric" key={title}>
                <div className={`metric-icon ${tone}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <span>{title}</span>
                  <strong>{value.toString().padStart(2, "0")}</strong>
                </div>
              </div>
            ))}
          </section>
          <section className="workspace">
            <div className="queue-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {t.queue}
                    <span className="count">{filtered.length}</span>
                  </h2>
                  <p>{t.queueHelp}</p>
                </div>
              </div>
              <div className="search">
                <Search size={16} />
                <input
                  aria-label={t.search}
                  placeholder={t.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="filters" role="group" aria-label={t.queue}>
                {(["open", "review", "all", "closed"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "active-filter" : ""}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {
                      {
                        open: t.open,
                        review: t.inReview,
                        all: t.all,
                        closed: t.closed,
                      }[f]
                    }
                  </button>
                ))}
              </div>
              <div className="case-list">
                {loading ? (
                  <p className="empty">{t.loading}</p>
                ) : filtered.length === 0 ? (
                  <p className="empty">{t.noCases}</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      disabled={busy}
                      className={`case-card ${selected === c.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelected(c.id);
                        if (window.matchMedia("(max-width: 800px)").matches)
                          requestAnimationFrame(() =>
                            detailRef.current?.scrollIntoView({
                              behavior: "smooth",
                            }),
                          );
                      }}
                      aria-pressed={selected === c.id}
                    >
                      <span className="case-top">
                        <span className="case-id">{c.id}</span>
                        <span className="case-age">
                          {age(c.created_at, language)}
                        </span>
                      </span>
                      <strong>
                        {language === "hi" ? c.title_hi : c.title_en}
                      </strong>
                      <span className="case-location">
                        {place(c.locality, language)}
                      </span>
                      <span className="case-bottom">
                        <span className={`status ${c.stage}`}>
                          {label(t, c.stage)}
                        </span>
                        {c.priority === "high" && (
                          <span className="priority">
                            <span /> {t.high}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="case-chevron" size={16} />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="detail-panel" ref={detailRef}>
              {!current ? (
                <div className="empty-detail">
                  <div className="empty-icon">
                    <FileText size={24} />
                  </div>
                  <h2>{t.selectCase}</h2>
                  <p>{t.selectHint}</p>
                </div>
              ) : (
                <>
                  <div className="detail-header">
                    <div className="detail-meta">
                      <span className="case-id">{current.id}</span>
                      <span className={`status ${current.stage}`}>
                        {label(t, current.stage)}
                      </span>
                    </div>
                    <h2>
                      {language === "hi" ? current.title_hi : current.title_en}
                    </h2>
                    <div className="detail-sub">
                      <span>{place(current.locality, language)}</span>
                      <span>·</span>
                      <span>
                        {t.created} {displayDate(current.created_at, language)}
                      </span>
                    </div>
                  </div>
                  <div className="detail-body">
                    <div className="progress-box">
                      <div className="progress-top">
                        <span className="overline">{t.currentStage}</span>
                        <strong>{label(t, current.stage)}</strong>
                      </div>
                      <div className="progress-track" aria-hidden="true">
                        <i className="filled" />
                        <i
                          className={
                            ["assigned", "review", "resolved"].includes(
                              current.stage,
                            )
                              ? "filled"
                              : ""
                          }
                        />
                        <i
                          className={
                            ["review", "resolved"].includes(current.stage)
                              ? "filled"
                              : ""
                          }
                        />
                      </div>
                      <p>{stageHelp(t, current.stage)}</p>
                    </div>
                    <div className="report">
                      <div className="section-row">
                        <div>
                          <span className="overline">01 / {t.report}</span>
                          <h3>{t.report}</h3>
                        </div>
                        <FileText size={18} />
                      </div>
                      <p>
                        {language === "hi"
                          ? current.description_hi
                          : current.description_en}
                      </p>
                      <small>{t.reportHelp}</small>
                    </div>
                    <div className="assistant">
                      <div className="assistant-heading">
                        <span className="assistant-icon">
                          <Sparkles size={17} />
                        </span>
                        <div>
                          <h3>{t.aiTitle}</h3>
                          <p>{t.aiSubtitle}</p>
                        </div>
                        <span className="assistant-tag">AI</span>
                      </div>
                      <p className="assistant-intro">{t.aiIntro}</p>
                      {advice && (
                        <div className="suggestion">
                          <strong>
                            {advice.mode === "ai" ? t.aiLabel : t.previewLabel}
                          </strong>
                          <p>{advice.text}</p>
                          {advice.mode === "preview" && (
                            <small>{t.aiNoKey}</small>
                          )}
                        </div>
                      )}
                      <button
                        className="assistant-button"
                        onClick={askAdvice}
                        disabled={advising}
                      >
                        <Sparkles size={15} />
                        {advising ? t.aiLoading : t.aiButton}
                      </button>
                      <div className="assistant-warning">
                        <ShieldCheck size={14} />
                        {t.aiWarning}
                      </div>
                    </div>
                    {Object.keys(transitions[current.stage]).length > 0 && (
                      <div className="decision">
                        <div className="section-row">
                          <div>
                            <span className="overline">02 / {t.actions}</span>
                            <h3>{t.decision}</h3>
                          </div>
                          <ArrowDownLeft size={18} />
                        </div>
                        <p>{t.decisionHelp}</p>
                        <label>
                          {t.noteLabel}
                          <textarea
                            value={note}
                            maxLength={1000}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t.notePlaceholder}
                          />
                        </label>
                        <div className="action-buttons">
                          {(
                            Object.keys(transitions[current.stage]) as Action[]
                          ).map((a, i) => (
                            <button
                              key={a}
                              disabled={busy}
                              className={i === 0 ? "primary" : "secondary"}
                              onClick={() => submitAction(a)}
                            >
                              {t[a]}
                              {i === 0 && <ArrowRight size={15} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {error && (
                      <p className="error" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="timeline">
                      <div className="section-row">
                        <div>
                          <span className="overline">03 / {t.allActivity}</span>
                          <h3>{t.history}</h3>
                        </div>
                        <Clock3 size={18} />
                      </div>
                      {detail.events.length === 0 ? (
                        <p>{t.noHistory}</p>
                      ) : (
                        <ol>
                          {detail.events.map((e) => (
                            <li key={e.id}>
                              <span className="timeline-dot" />
                              <div>
                                <strong>{eventName(t, e.action)}</strong>
                                <time>
                                  {displayDate(e.created_at, language)}
                                </time>
                                {e.note && <p>{e.note}</p>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
      {adding && (
        <NewComplaint
          t={t}
          onClose={closeModal}
          onCreated={(c) => {
            closeModal();
            setFilter("all");
            setQuery("");
            void loadCases(c.id);
          }}
        />
      )}
    </div>
  );
}

function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    api("/session")
      .then(() => setSession(true))
      .catch(() => setSession(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  if (session === null)
    return <div className="initial-loading">{copy[language].loading}</div>;
  return session ? (
    <Workspace
      language={language}
      setLanguage={setLanguage}
      onLogout={() => setSession(false)}
    />
  ) : (
    <Login
      language={language}
      setLanguage={setLanguage}
      onLogin={() => setSession(true)}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
