// =============================================================================
// UMA Market — JSON-LD serialization XSS regression test
//
// Product name/description are user-controlled. A raw "</script>" inside a
// JSON-LD <script> element terminates the tag early, so the remainder parses
// as HTML (stored XSS). serializeJsonLd must make that breakout impossible
// while preserving the parsed JSON value.
// =============================================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import { serializeJsonLd } from "../../src/lib/json-ld";

const XSS_PAYLOAD = "</script><script>alert(1)</script>";

test("serializeJsonLd prevents script-tag breakout from user-controlled product fields", () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: XSS_PAYLOAD,
    description: `Fresh ${XSS_PAYLOAD} tomatoes`,
  };

  const serialized = serializeJsonLd(jsonLd);

  assert.ok(
    !serialized.includes("</script>"),
    "serialized JSON-LD must not contain a raw </script> sequence",
  );
  assert.ok(
    !serialized.includes("<script>"),
    "serialized JSON-LD must not contain a raw <script> sequence",
  );
  assert.deepEqual(
    JSON.parse(serialized),
    jsonLd,
    "escaping must not change the parsed JSON value",
  );
});

test("serializeJsonLd leaves ordinary product data byte-identical to JSON.stringify", () => {
  const jsonLd = {
    "@type": "Product",
    name: "Fresh Tomatoes",
    offers: { price: 60, priceCurrency: "PHP" },
  };

  assert.equal(serializeJsonLd(jsonLd), JSON.stringify(jsonLd));
});
