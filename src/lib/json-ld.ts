/**
 * Serializes JSON-LD for embedding in a <script type="application/ld+json">.
 *
 * User-controlled strings (product name/description) must never terminate the
 * script element: a raw "</script>" inside the JSON would end the tag early
 * and let the remainder parse as HTML (stored XSS). Escaping "<" keeps the
 * JSON valid while making breakout sequences inert.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
