import test from "node:test";
import assert from "node:assert/strict";
import { HUES, STATE_KEYS, tokenPaths, HEX_RE, HUE_REF_RE, TOKEN_REF_RE } from "../src/contract.mjs";

test("HUES lists the eight base hues then the three aliases", () => {
  assert.deepEqual(HUES, ["gray","red","orange","yellow","green","cyan","blue","purple","accent","interactive","neutral"]);
});

test("STATE_KEYS are the five interaction states", () => {
  assert.deepEqual(STATE_KEYS, ["$hovered","$focused","$pressed","$selected","$disabled"]);
});

test("tokenPaths covers every documented path", () => {
  const paths = tokenPaths();
  for (const p of [
    "text.base", "text.muted",
    "text.action.primary.base", "text.action.destructive.$disabled",
    "text.formfield.$selected",
    "text.feedback.error.base", "text.feedback.info.muted",
    "background.base", "background.raised.high", "background.raised.max",
    "background.action.secondary.$pressed",
    "background.feedback.warning.base",
    "border.base", "scrollbar.base",
    "diff.text.hunkHeader", "diff.background.context",
    "diff.highlight.removed", "diff.lineNumber.background.added",
    "syntax.punctuation", "markdown.listEnumeration", "markdown.codeBlock",
    "@dialog.background.base", "@dialog.background.action.primary.$hovered",
  ]) assert.ok(paths.includes(p), `missing ${p}`);
  assert.ok(!paths.includes("categorical"));
});

test("HEX_RE accepts 6 and 8 digit hex, rejects 3 digit", () => {
  assert.ok(HEX_RE.test("#0e1620"));
  assert.ok(HEX_RE.test("#0e1620ff"));
  assert.ok(HEX_RE.test("#ABC"));
  assert.ok(!HEX_RE.test("0e1620"));
});

test("HUE_REF_RE accepts a whole hue or a valid step only", () => {
  assert.ok(HUE_REF_RE.test("$hue.accent"));
  assert.ok(HUE_REF_RE.test("$hue.cyan.400"));
  assert.ok(!HUE_REF_RE.test("$hue.cyan.450"));
  assert.ok(!HUE_REF_RE.test("$hue.cyan.1000"));
});

test("TOKEN_REF_RE accepts a token path, including camelCase, and not a hue", () => {
  assert.ok(TOKEN_REF_RE.test("$text.muted"));
  assert.ok(TOKEN_REF_RE.test("$background.raised.base"));
  assert.ok(TOKEN_REF_RE.test("$markdown.codeBlock"));
  assert.ok(TOKEN_REF_RE.test("$diff.lineNumber.background.added"));
  assert.ok(TOKEN_REF_RE.test("$@dialog.background.base"));
  assert.ok(!TOKEN_REF_RE.test("$hue.cyan.300"));
  assert.ok(!TOKEN_REF_RE.test("text.muted"));
});
