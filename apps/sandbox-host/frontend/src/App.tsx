import { FeedbackButton, FeedbackProvider } from "@rl3/feedback-widget";
import { useState } from "react";

import { type SandboxRole, getSandboxRole, sandboxBindings, setSandboxRole } from "./bindings";

// Patrón A (2026-05-16) — the dedicated admin triage route is gone.
// Admins access the same UX as users via the floating launcher; the
// scope chip "Mine / All" inside the sheet flips the ticket list
// between own and tenant-wide.

export function App() {
  const [role, setRole] = useState<SandboxRole>(getSandboxRole());

  const switchRole = (next: SandboxRole) => {
    setSandboxRole(next);
    setRole(next);
  };

  return (
    <FeedbackProvider bindings={sandboxBindings}>
      <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
        <Sidebar role={role} switchRole={switchRole} />
        <div className="flex flex-1 flex-col">
          <Topbar role={role} />
          <main className="flex-1 overflow-y-auto bg-zinc-950 px-8 py-8">
            <Dashboard />
          </main>
        </div>
        <FeedbackButton />
      </div>
    </FeedbackProvider>
  );
}

interface SidebarProps {
  role: SandboxRole;
  switchRole: (role: SandboxRole) => void;
}

function Sidebar({ role, switchRole }: SidebarProps) {
  const navItem = (label: string, icon: string, active: boolean) => {
    return (
      <button
        type="button"
        className={[
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-zinc-800 text-zinc-50 shadow-inner"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
        ].join(" ")}
      >
        <span aria-hidden="true" className="text-base">{icon}</span>
        <span className="font-medium">{label}</span>
      </button>
    );
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60 px-4 py-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 text-xs font-bold text-zinc-950 shadow-lg shadow-cyan-500/20">
          RL3
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-zinc-50">Feedback</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Widget sandbox
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-500">
          Overview
        </p>
        {navItem("Dashboard", "▦", true)}
      </nav>

      <div className="mt-auto flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Sandbox role</p>
        <select
          value={role}
          onChange={(e) => switchRole(e.target.value as SandboxRole)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 focus:border-cyan-500 focus:outline-none"
        >
          <option value="staff">staff</option>
          <option value="manager">manager</option>
          <option value="admin">admin (master)</option>
        </select>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
          MailHog →{" "}
          <a
            href="http://localhost:8226"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            :8226
          </a>
        </p>
      </div>
    </aside>
  );
}

function Topbar({ role }: { role: SandboxRole }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-8 py-4 backdrop-blur">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Demo host</p>
        <h1 className="text-lg font-semibold text-zinc-50">Welcome to the Feedback Sandbox</h1>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-zinc-400">Live data</span>
        <span className="text-zinc-700">·</span>
        <span className="font-medium text-zinc-100">{role}</span>
      </div>
    </header>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "primary" | "warning" | "danger";
  icon: string;
}) {
  const toneClass =
    tone === "primary"
      ? "text-cyan-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-rose-400"
          : "text-zinc-50";
  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-lg">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span aria-hidden="true" className="text-zinc-600 transition-colors group-hover:text-zinc-400">
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${toneClass}`}>{value}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50">
            Welcome to the Feedback Sandbox
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live API data
          </span>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          Demo host that mounts <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-cyan-300">
            @rl3/feedback-widget
          </code>{" "}
          with header-driven fake auth. Toggle the sandbox role in the sidebar to switch between
          submitter and admin. Click the floating <span className="text-cyan-400">RL3 Feedback</span>{" "}
          button (bottom-right) to open the chat-first capture sheet — the same UX shipped to
          production hosts (Compliance Brain, sapphira-clinic).
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total feedbacks" value="42" hint="14 active" icon="📥" tone="default" />
        <MetricCard
          label="In progress"
          value="8"
          hint="Cases under review"
          tone="primary"
          icon="↻"
        />
        <MetricCard
          label="High severity"
          value="3"
          hint="Blocker + Major tier"
          tone="danger"
          icon="!"
        />
        <MetricCard
          label="My open tasks"
          value="12"
          hint="2 overdue · view all →"
          tone="warning"
          icon="🗂"
        />
        <MetricCard label="Chat sessions" value="25" hint="80% confirmed" icon="💬" tone="default" />
        <MetricCard
          label="Resolved this week"
          value="4"
          hint="DONE + WONT_FIX"
          tone="default"
          icon="✓"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Tickets by Status</h3>
            <span className="text-[10px] text-zinc-500">last 30 days</span>
          </div>
          <BarPlaceholder
            rows={[
              { label: "NEW", value: 14, color: "bg-emerald-500" },
              { label: "TRIAGED", value: 8, color: "bg-sky-500" },
              { label: "IN_PROGRESS", value: 6, color: "bg-amber-500" },
              { label: "DONE", value: 10, color: "bg-violet-500" },
              { label: "WONT_FIX", value: 4, color: "bg-zinc-600" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Severity distribution</h3>
            <span className="text-[10px] text-zinc-500">all-time</span>
          </div>
          <BarPlaceholder
            rows={[
              { label: "BLOCKER", value: 1, color: "bg-rose-500" },
              { label: "MAJOR", value: 6, color: "bg-amber-500" },
              { label: "MINOR", value: 14, color: "bg-emerald-500" },
              { label: "IDEA", value: 9, color: "bg-sky-500" },
            ]}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <span aria-hidden="true" className="text-cyan-400">
              ⌁
            </span>{" "}
            Recent activity
          </h3>
          <span className="text-[10px] text-zinc-500">mocked sample</span>
        </div>
        <ul className="flex flex-col gap-2 text-xs">
          <ActivityRow
            tag="feedback.created"
            label="Staff opened a chat session and confirmed a feedback row"
            ts="just now"
          />
          <ActivityRow
            tag="feedback.status_changed"
            label="Admin moved FB-2026-0042 → IN_PROGRESS"
            ts="2 min ago"
          />
          <ActivityRow
            tag="chat.synthesis"
            label="Synthesis card emitted (mode=synthesize, coverage=0.82)"
            ts="5 min ago"
          />
          <ActivityRow
            tag="feedback.attachment_uploaded"
            label="Screenshot attached to FB-2026-0040 via /chat confirm"
            ts="12 min ago"
          />
        </ul>
      </section>
    </div>
  );
}

interface BarRow {
  label: string;
  value: number;
  color: string;
}

function BarPlaceholder({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3 text-xs">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 font-mono text-[11px] text-zinc-400">{r.label}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-2.5 rounded-full ${r.color} transition-all`}
              style={{ width: `${(r.value / max) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <span className="w-8 shrink-0 text-right font-semibold text-zinc-100">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({
  tag,
  label,
  ts,
}: {
  tag: string;
  label: string;
  ts: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 transition-colors hover:border-zinc-700">
      <code className="shrink-0 rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
        {tag}
      </code>
      <span className="flex-1 text-zinc-300">{label}</span>
      <span className="shrink-0 text-[10px] text-zinc-500">{ts}</span>
    </li>
  );
}
