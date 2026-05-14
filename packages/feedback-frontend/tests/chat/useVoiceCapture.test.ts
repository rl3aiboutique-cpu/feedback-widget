/**
 * useVoiceCapture — feature-detect tests (S4).
 *
 * The package ships no jsdom; we run vitest against a thin set of
 * globals we install in each test. That's enough to exercise the hook's
 * feature-detect logic, which is what callers (Composer + the sheet)
 * actually branch on to decide whether to show the mic button.
 *
 * The interesting blob-producing state machine (start → recording →
 * stop → blob) is Promise-driven and can't be unit-tested without a
 * DOM that exposes MediaRecorder events. We verify:
 *
 *   - The feature detector returns true when MediaRecorder +
 *     getUserMedia exist on `window`.
 *   - The feature detector returns false when MediaRecorder is missing
 *     (Safari < 14 / HTTP-only origins).
 *   - The feature detector returns false when getUserMedia is missing.
 *   - The feature detector returns false on the server (no `window`).
 *
 * Note: we set `globalThis.window` but NOT `globalThis.navigator`. The
 * hook reads `window.navigator.mediaDevices`, not the bare
 * `navigator` global — and Node 22 declares `globalThis.navigator` as a
 * getter-only, so writes throw. Mocking only `window` is sufficient.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { isVoiceCaptureSupported } from "../../src/chat/useVoiceCapture";

const _origWindow = (globalThis as Record<string, unknown>).window;

function _restore(): void {
  (globalThis as Record<string, unknown>).window = _origWindow;
}

/** Build a fake MediaRecorder constructor + isTypeSupported pair. We
 * use a plain function rather than a class with only static members
 * (biome forbids the latter under noStaticOnlyClass). */
function _makeMediaRecorderStub(isTypeSupported: (mt: string) => boolean): unknown {
  const ctor = function _MediaRecorderStub(this: unknown) {
    /* never instantiated in feature-detect tests */
  };
  (ctor as unknown as { isTypeSupported: (mt: string) => boolean }).isTypeSupported =
    isTypeSupported;
  return ctor;
}

afterEach(() => {
  _restore();
  vi.restoreAllMocks();
});

describe("isVoiceCaptureSupported", () => {
  it("returns false when window is undefined (SSR)", () => {
    (globalThis as Record<string, unknown>).window = undefined;
    expect(isVoiceCaptureSupported()).toBe(false);
  });

  it("returns false when MediaRecorder is missing", () => {
    (globalThis as Record<string, unknown>).window = {
      navigator: {
        mediaDevices: { getUserMedia: vi.fn() },
      },
      // MediaRecorder intentionally absent — Safari < 14 / HTTP origin
    };
    expect(isVoiceCaptureSupported()).toBe(false);
  });

  it("returns false when getUserMedia is missing", () => {
    (globalThis as Record<string, unknown>).window = {
      MediaRecorder: _makeMediaRecorderStub(() => true),
      navigator: {
        // mediaDevices present but getUserMedia missing — older Safari iframes
        mediaDevices: {},
      },
    };
    expect(isVoiceCaptureSupported()).toBe(false);
  });

  it("returns true when MediaRecorder + getUserMedia are present", () => {
    const getUserMedia = vi.fn();
    (globalThis as Record<string, unknown>).window = {
      MediaRecorder: _makeMediaRecorderStub((mt) => mt.startsWith("audio/webm")),
      navigator: { mediaDevices: { getUserMedia } },
    };
    expect(isVoiceCaptureSupported()).toBe(true);
  });
});
