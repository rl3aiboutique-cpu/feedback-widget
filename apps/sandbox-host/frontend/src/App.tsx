import {
	FeedbackButton,
	FeedbackProvider,
	FeedbackTriagePage,
} from "@rl3/feedback-widget";
import { useEffect, useState } from "react";

import {
	type SandboxRole,
	getSandboxRole,
	sandboxBindings,
	setSandboxRole,
} from "./bindings";

type View = "home" | "admin";

function _routeFromUrl(): View {
	if (typeof window === "undefined") return "home";
	const path = window.location.pathname;
	if (path.startsWith("/admin/feedback")) return "admin";
	return "home";
}

export function App() {
	const [view, setView] = useState<View>(_routeFromUrl());
	const [role, setRole] = useState<SandboxRole>(getSandboxRole());

	useEffect(() => {
		const onPop = () => setView(_routeFromUrl());
		window.addEventListener("popstate", onPop);
		return () => window.removeEventListener("popstate", onPop);
	}, []);

	const navigate = (path: string, nextView: View) => {
		window.history.pushState({}, "", path);
		setView(nextView);
	};

	const switchRole = (next: SandboxRole) => {
		setSandboxRole(next);
		setRole(next);
	};

	return (
		<FeedbackProvider bindings={sandboxBindings}>
			<div
				style={{
					minHeight: "100vh",
					fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
					background: "#f8fafc",
					color: "#0f172a",
				}}
			>
				<header
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "12px 24px",
						borderBottom: "1px solid #e2e8f0",
						background: "#fff",
					}}
				>
					<strong>Feedback Sandbox</strong>
					<nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
						<button
							type="button"
							onClick={() => navigate("/", "home")}
							style={{ padding: "6px 12px" }}
						>
							Home
						</button>
						<button
							type="button"
							onClick={() => navigate("/admin/feedback", "admin")}
							style={{ padding: "6px 12px" }}
						>
							Admin triage
						</button>
						<span style={{ marginLeft: 16 }}>Role:</span>
						<select
							value={role}
							onChange={(e) => switchRole(e.target.value as SandboxRole)}
						>
							<option value="staff">staff</option>
							<option value="manager">manager</option>
							<option value="admin">admin (master)</option>
						</select>
					</nav>
				</header>

				<main style={{ maxWidth: 960, margin: "32px auto", padding: "0 24px" }}>
					{view === "home" && <Home />}
					{view === "admin" && <FeedbackTriagePage />}
				</main>

				{/* Mounted everywhere: the floating button is visible on every route. */}
				<FeedbackButton />
			</div>
		</FeedbackProvider>
	);
}

function Home() {
	return (
		<>
			<h1>Welcome to the Feedback Sandbox</h1>
			<p style={{ maxWidth: 640 }}>
				This is a minimal demo host that mounts{" "}
				<code>@rl3/feedback-widget</code> with header-driven fake auth. Toggle
				the role in the top-right to switch between <em>staff</em> (can submit),{" "}
				<em>manager</em>, and <em>admin</em> (can triage). Click the floating
				RL3 button to open the feedback panel.
			</p>
			<p style={{ maxWidth: 640 }}>
				After submitting feedback, switch to <strong>admin</strong>, open{" "}
				<strong>Admin triage</strong>, and walk it through the lifecycle. Email
				notifications land in MailHog at{" "}
				<a href="http://localhost:8226" target="_blank" rel="noreferrer">
					http://localhost:8226
				</a>
				.
			</p>
		</>
	);
}
