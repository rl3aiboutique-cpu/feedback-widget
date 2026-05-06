/**
 * Builds the redacted technical-metadata bundle attached to each
 * submission. Pure function: takes a snapshot at the moment the user
 * presses submit. Every string flows through the redactor before it
 * lands in the result.
 *
 * Some sources (console, network, breadcrumbs) maintain their own
 * ring buffers and contribute via `getXTail()`. The bundle captures a
 * shallow snapshot so the submission payload is JSON-clean.
 */

import { redactBundle } from "../redactors";
import type { CurrentUserSnapshot } from "../types";
import { getBreadcrumbs } from "./breadcrumbs";
import { getConsoleTail } from "./consoleWrap";
import { getNetworkTail } from "./networkWrap";

export interface MetadataBundle {
  url: string;
  route_name: string | null;
  viewport: { w: number; h: number; dpr: number };
  user_agent: string;
  platform: string;
  locale: string;
  timezone: string;
  app_version: string;
  git_commit_sha: string;
  current_user: { id: string; email: string; role: string } | null;
  timestamp: string;
  console_tail: ReturnType<typeof getConsoleTail>;
  network_tail: ReturnType<typeof getNetworkTail>;
  breadcrumbs: ReturnType<typeof getBreadcrumbs>;
  selected_element: SelectedElementInfo | null;
  feature_flags: Record<string, boolean>;
}

export interface SelectedElementInfo {
  selector: string;
  xpath: string | null;
  tag: string;
  role: string | null;
  accessible_name: string | null;
  bounding_box: { x: number; y: number; w: number; h: number };
  outer_html_excerpt: string;
}

export interface BuildBundleArgs {
  routeName: string | null;
  appVersion: string;
  gitSha: string;
  user: CurrentUserSnapshot | null;
  selectedElement: SelectedElementInfo | null;
  featureFlags?: Record<string, boolean>;
}

export function buildMetadataBundle(args: BuildBundleArgs): MetadataBundle {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
      : "";
  const viewport =
    typeof window !== "undefined"
      ? {
          w: window.innerWidth,
          h: window.innerHeight,
          dpr: window.devicePixelRatio,
        }
      : { w: 0, h: 0, dpr: 1 };
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform =
    typeof navigator !== "undefined" ? ((navigator as { platform?: string }).platform ?? "") : "";
  const locale = typeof navigator !== "undefined" ? navigator.language : "";
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  })();

  const raw: MetadataBundle = {
    url,
    route_name: args.routeName,
    viewport,
    user_agent: ua,
    platform,
    locale,
    timezone,
    app_version: args.appVersion,
    git_commit_sha: args.gitSha,
    current_user: args.user
      ? { id: args.user.id, email: args.user.email, role: args.user.role }
      : null,
    timestamp: new Date().toISOString(),
    console_tail: getConsoleTail(),
    network_tail: getNetworkTail(),
    breadcrumbs: getBreadcrumbs(),
    selected_element: args.selectedElement,
    feature_flags: args.featureFlags ?? {},
  };

  // Redact every string inside the bundle before it leaves the browser.
  // The server-side redactor in app/feedback/redaction.py runs as the
  // second line of defence.
  return redactBundle(raw);
}
