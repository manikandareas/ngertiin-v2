import { expect, test } from "bun:test";
import { citationMarkerIds } from "./chat.js";

const firstId = "c051bf9a-4790-4765-83a8-358b2a512813";
const secondId = "3b760eef-ded2-4a20-bacc-d299a4715eb5";

test("extracts canonical and provider-style material citation IDs", () => {
  const text = `[[cite:${firstId}]] cite${firstId}turn${secondId}`;
  expect([...citationMarkerIds(text)]).toEqual([firstId, secondId]);
});

test("ignores incomplete and non-UUID citation references", () => {
  const text = `cite${firstId} citeturn0search0 [[cite:invalid]]`;
  expect([...citationMarkerIds(text)]).toEqual([]);
});
