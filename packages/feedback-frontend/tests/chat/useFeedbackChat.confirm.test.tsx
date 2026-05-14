/**
 * useFeedbackChat — confirm + abandon URL builder tests (S5b).
 *
 * The package ships no jsdom and no @testing-library/react (S3F Batch A
 * constraint forbids new npm deps), so we cannot mount the hook directly
 * to drive React state. Instead, we exercise the two pure URL builders
 * extracted alongside the hook (`_buildConfirmUrl`, `_buildAbandonUrl`).
 *
 * These two helpers carry the load-bearing behaviour of the new wiring:
 *
 *   - they honour the host-injected apiBaseUrl + apiPathPrefix
 *   - they percent-encode the session id so weird ids round-trip safely
 *   - they pin the URL shape the backend's S5 endpoints expect
 *
 * If either of these breaks, the real confirm/abandon fetches will hit
 * the wrong path and the entire end-of-flow silently regresses.
 */
import { describe, expect, it } from "vitest";

import type { FeedbackHostBindings } from "../../src/adapter";
import { _buildAbandonUrl, _buildConfirmUrl } from "../../src/chat/useFeedbackChat";

function _bindings(overrides: Partial<FeedbackHostBindings> = {}): FeedbackHostBindings {
  return {
    useCurrentUser: () => null,
    getCsrfToken: async () => "",
    apiBaseUrl: "https://api.example.com",
    ...overrides,
  };
}

describe("_buildConfirmUrl", () => {
  it("uses the default /api/v1/feedback prefix when none provided", () => {
    const url = _buildConfirmUrl(_bindings(), "sid-123");
    expect(url).toBe("https://api.example.com/api/v1/feedback/chat/sessions/sid-123/confirm");
  });

  it("honours an explicit apiPathPrefix override", () => {
    const url = _buildConfirmUrl(_bindings({ apiPathPrefix: "/feedback" }), "sid-123");
    expect(url).toBe("https://api.example.com/feedback/chat/sessions/sid-123/confirm");
  });

  it("strips a single trailing slash from apiBaseUrl", () => {
    const url = _buildConfirmUrl(_bindings({ apiBaseUrl: "https://api.example.com/" }), "sid-123");
    expect(url).toBe("https://api.example.com/api/v1/feedback/chat/sessions/sid-123/confirm");
  });

  it("percent-encodes the session id", () => {
    const url = _buildConfirmUrl(_bindings(), "sid with space");
    expect(url).toContain("sid%20with%20space/confirm");
  });
});

describe("_buildAbandonUrl", () => {
  it("uses the default /api/v1/feedback prefix when none provided", () => {
    const url = _buildAbandonUrl(_bindings(), "sid-123");
    expect(url).toBe("https://api.example.com/api/v1/feedback/chat/sessions/sid-123/abandon");
  });

  it("honours an explicit apiPathPrefix override", () => {
    const url = _buildAbandonUrl(_bindings({ apiPathPrefix: "/feedback" }), "sid-123");
    expect(url).toBe("https://api.example.com/feedback/chat/sessions/sid-123/abandon");
  });

  it("percent-encodes the session id", () => {
    const url = _buildAbandonUrl(_bindings(), "sid/weird");
    expect(url).toContain("sid%2Fweird/abandon");
  });
});
