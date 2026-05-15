/**
 * Idempotency key helper — extracted from the deleted legacy
 * ``client/iter.ts`` so the chat stream + any other widget caller can
 * still generate replay-safe keys without depending on the iter
 * surface (Sprint C deprecation).
 */

export function newIdempotencyKey(): string {
  // crypto.randomUUID is available in every browser the widget
  // targets (Chrome 92+, Firefox 95+, Safari 15.4+, Edge 92+). Fall
  // back to a Math.random-based UUID for SSR / non-secure contexts
  // where crypto.randomUUID may be undefined.
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  // RFC 4122 v4 fallback. Not cryptographically strong; only used in
  // environments where crypto.randomUUID is unavailable.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
