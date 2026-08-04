import assert from "node:assert/strict";
import test from "node:test";

import { parseByteRange } from "../lib/http-range.mjs";

test("parses explicit, open-ended, and suffix byte ranges", () => {
  assert.deepEqual(parseByteRange("bytes=0-99", 1_000), {
    start: 0,
    end: 99,
    length: 100,
  });
  assert.deepEqual(parseByteRange("bytes=900-", 1_000), {
    start: 900,
    end: 999,
    length: 100,
  });
  assert.deepEqual(parseByteRange("bytes=-125", 1_000), {
    start: 875,
    end: 999,
    length: 125,
  });
});

test("rejects malformed, multiple, and unsatisfiable ranges", () => {
  assert.equal(parseByteRange(undefined, 1_000), undefined);
  assert.equal(parseByteRange("items=0-20", 1_000), null);
  assert.equal(parseByteRange("bytes=0-20,40-60", 1_000), null);
  assert.equal(parseByteRange("bytes=1200-1400", 1_000), null);
  assert.equal(parseByteRange("bytes=30-20", 1_000), null);
});

