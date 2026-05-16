/**
 * FooterActions visibility tests.
 *
 * Note: this package does not ship `@testing-library/react` or `jsdom`,
 * and the S3F Batch A constraints forbid adding new npm deps. We use
 * `renderToStaticMarkup` from `react-dom/server` to assert the rendered
 * HTML directly — the 8 cases from the plan (5 hidden states + confirming
 * + finalizing + error) are preserved. Buttons are located via their
 * `data-feedback-id` attributes (stable test anchors set by the component).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FooterActions } from "../../src/chat/FooterActions";
import type { ChatState } from "../../src/chat/types";

const handlers = {
  onConfirm: vi.fn(),
  onAdjust: vi.fn(),
  onRetry: vi.fn(),
};

function html(state: ChatState): string {
  return renderToStaticMarkup(<FooterActions state={state} {...handlers} />);
}

/**
 * Extract the opening-tag attribute string for a button identified by its
 * `data-feedback-id`. Returns null when the button is absent.
 */
function buttonAttrs(htmlStr: string, feedbackId: string): string | null {
  const re = new RegExp(`<button([^>]*\\bdata-feedback-id="${feedbackId}"[^>]*)>`, "i");
  const match = htmlStr.match(re);
  return match ? (match[1] ?? "") : null;
}

const HIDDEN_STATES: ChatState[] = ["idle", "opening", "awaiting_user", "bot_thinking", "done"];

describe("FooterActions — hidden states", () => {
  for (const s of HIDDEN_STATES) {
    it(`hides both buttons when state=${s}`, () => {
      const out = html(s);
      expect(out).toBe("");
      expect(buttonAttrs(out, "feedback.footer.confirm")).toBeNull();
      expect(buttonAttrs(out, "feedback.footer.adjust")).toBeNull();
    });
  }
});

describe("FooterActions — visible states", () => {
  it("shows Confirmar + Sigamos iterando enabled when state=confirming", () => {
    const out = html("confirming");
    const confirm = buttonAttrs(out, "feedback.footer.confirm");
    const adjust = buttonAttrs(out, "feedback.footer.adjust");
    expect(confirm).not.toBeNull();
    expect(adjust).not.toBeNull();
    // The HTML `disabled` boolean attribute is only emitted when the prop
    // is truthy; class names that contain "disabled:" are irrelevant.
    expect(confirm).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(adjust).not.toMatch(/\sdisabled(=|\s|>)/);
    // Labels are present in the rendered text.
    expect(out).toMatch(/Confirmar/);
    expect(out).toMatch(/Sigamos iterando/);
  });

  it("disables both buttons when state=finalizing", () => {
    const out = html("finalizing");
    const confirm = buttonAttrs(out, "feedback.footer.confirm");
    const adjust = buttonAttrs(out, "feedback.footer.adjust");
    expect(confirm).not.toBeNull();
    expect(adjust).not.toBeNull();
    expect(confirm).toMatch(/\sdisabled(=|\s|>)/);
    expect(adjust).toMatch(/\sdisabled(=|\s|>)/);
  });

  it("shows Reintentar when state=error", () => {
    const out = html("error");
    // The error-state button has no data-feedback-id, so assert via label.
    expect(out).toMatch(/Reintentar/);
    // And no `disabled` boolean attribute on any button tag.
    const buttonOpenTags = out.match(/<button[^>]*>/g) ?? [];
    expect(buttonOpenTags.length).toBeGreaterThan(0);
    for (const tag of buttonOpenTags) {
      expect(tag).not.toMatch(/\sdisabled(=|\s|>)/);
    }
  });
});
