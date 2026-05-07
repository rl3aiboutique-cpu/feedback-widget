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
import { getErrorsTail } from "./errorWrap";
import { getNetworkSuccessTail, getNetworkTail } from "./networkWrap";

export interface NavigationTimingSnapshot {
  ttfb_ms: number | null;
  dom_content_loaded_ms: number | null;
  load_event_end_ms: number | null;
  dom_interactive_ms: number | null;
}

export interface ConnectionInfo {
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  save_data: boolean | null;
}

export interface PageInfo {
  title: string;
  referrer: string;
  age_ms: number;
}

export interface MemoryInfo {
  used_js_heap_size: number;
  total_js_heap_size: number;
  js_heap_size_limit: number;
}

export interface MetadataBundle {
  url: string;
  route_name: string | null;
  viewport: {
    w: number;
    h: number;
    dpr: number;
    scroll_y: number;
    document_height: number;
    visibility_state: string;
  };
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
  network_successes: ReturnType<typeof getNetworkSuccessTail>;
  errors_tail: ReturnType<typeof getErrorsTail>;
  breadcrumbs: ReturnType<typeof getBreadcrumbs>;
  selected_element: SelectedElementInfo | null;
  feature_flags: Record<string, boolean>;
  timing: NavigationTimingSnapshot;
  connection: ConnectionInfo | null;
  page: PageInfo;
  memory: MemoryInfo | null;
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

function _readNavigationTiming(): NavigationTimingSnapshot {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return {
      ttfb_ms: null,
      dom_content_loaded_ms: null,
      load_event_end_ms: null,
      dom_interactive_ms: null,
    };
  }
  try {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const nav = entries[0];
    if (!nav) {
      return {
        ttfb_ms: null,
        dom_content_loaded_ms: null,
        load_event_end_ms: null,
        dom_interactive_ms: null,
      };
    }
    return {
      ttfb_ms:
        nav.responseStart > 0 && nav.requestStart > 0
          ? Math.round(nav.responseStart - nav.requestStart)
          : null,
      dom_content_loaded_ms: nav.domContentLoadedEventEnd
        ? Math.round(nav.domContentLoadedEventEnd)
        : null,
      load_event_end_ms: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
      dom_interactive_ms: nav.domInteractive ? Math.round(nav.domInteractive) : null,
    };
  } catch {
    return {
      ttfb_ms: null,
      dom_content_loaded_ms: null,
      load_event_end_ms: null,
      dom_interactive_ms: null,
    };
  }
}

function _readConnectionInfo(): ConnectionInfo | null {
  if (typeof navigator === "undefined") return null;
  // Network Information API — only Chromium-family exposes it.
  const conn = (
    navigator as unknown as {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }
  ).connection;
  if (!conn) return null;
  return {
    effective_type: typeof conn.effectiveType === "string" ? conn.effectiveType : null,
    downlink_mbps: typeof conn.downlink === "number" ? conn.downlink : null,
    rtt_ms: typeof conn.rtt === "number" ? conn.rtt : null,
    save_data: typeof conn.saveData === "boolean" ? conn.saveData : null,
  };
}

function _readPageInfo(): PageInfo {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { title: "", referrer: "", age_ms: 0 };
  }
  const age =
    typeof performance !== "undefined" && performance.timeOrigin
      ? Math.round(Date.now() - performance.timeOrigin)
      : 0;
  return {
    title: document.title || "",
    referrer: document.referrer || "",
    age_ms: age,
  };
}

function _readMemoryInfo(): MemoryInfo | null {
  if (typeof performance === "undefined") return null;
  // performance.memory is non-standard (Chromium only).
  const mem = (
    performance as unknown as {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }
  ).memory;
  if (!mem) return null;
  return {
    used_js_heap_size: mem.usedJSHeapSize,
    total_js_heap_size: mem.totalJSHeapSize,
    js_heap_size_limit: mem.jsHeapSizeLimit,
  };
}

export function buildMetadataBundle(args: BuildBundleArgs): MetadataBundle {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
      : "";
  const documentHeight =
    typeof document !== "undefined" && document.documentElement
      ? document.documentElement.scrollHeight
      : 0;
  const visibilityState =
    typeof document !== "undefined" && document.visibilityState ? document.visibilityState : "";
  const viewport =
    typeof window !== "undefined"
      ? {
          w: window.innerWidth,
          h: window.innerHeight,
          dpr: window.devicePixelRatio,
          scroll_y: window.scrollY,
          document_height: documentHeight,
          visibility_state: visibilityState,
        }
      : {
          w: 0,
          h: 0,
          dpr: 1,
          scroll_y: 0,
          document_height: 0,
          visibility_state: "",
        };
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
    network_successes: getNetworkSuccessTail(),
    errors_tail: getErrorsTail(),
    breadcrumbs: getBreadcrumbs(),
    selected_element: args.selectedElement,
    feature_flags: args.featureFlags ?? {},
    timing: _readNavigationTiming(),
    connection: _readConnectionInfo(),
    page: _readPageInfo(),
    memory: _readMemoryInfo(),
  };

  // Redact every string inside the bundle before it leaves the browser.
  // The server-side redactor in app/feedback/redaction.py runs as the
  // second line of defence.
  return redactBundle(raw);
}
