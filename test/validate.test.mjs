import test from "node:test";
import assert from "node:assert/strict";
import { buildTheme } from "../src/theme.mjs";
import { validateTheme, CONTRAST_RULES } from "../src/validate.mjs";

// A small, self-contained spec — deliberately not fjord (Task 5) — that is valid
// before any test mutates it. All eight base hues share one verified ramp per
// mode; the three aliases are strings. Every colour below was measured against
// the contrast matrix, so the untouched fixture produces zero errors.
const DARK_RAMP = { 100: "#e6ecf2", 300: "#aebfcd", 500: "#7d90a3", 700: "#3a4b5a", 900: "#0e1620" };
const LIGHT_RAMP = { 100: "#202c38", 300: "#4a5a6b", 500: "#7b8b9c", 700: "#b3c0cc", 900: "#dbe3ea" };

const STATES = ["base", "$hovered", "$focused", "$pressed", "$selected", "$disabled"];
const allStates = (value) => Object.fromEntries(STATES.map((state) => [state, value]));

/** Eight base hues as the shared ramp, plus the three string aliases. */
const huesFor = (ramp) => ({
  gray: ramp,
  red: ramp,
  orange: ramp,
  yellow: ramp,
  green: ramp,
  cyan: ramp,
  blue: ramp,
  purple: ramp,
  accent: "$hue.cyan",
  interactive: "$hue.blue",
  neutral: "$hue.gray",
});

const spec = () => ({
  name: "fixture",
  categorical: ["accent", "cyan", "blue", "purple"],
  base: {
    text: {
      base: "#c6d4e0",
      muted: "#7d90a3",
      action: {
        primary: allStates("$hue.accent.400"),
        secondary: allStates("$hue.neutral.500"),
        destructive: allStates("$hue.red.400"),
      },
      formfield: allStates("$text.base"),
      feedback: {
        error: { base: "$hue.red.200", muted: "$hue.red.300" },
        warning: { base: "$hue.yellow.200", muted: "$hue.yellow.300" },
        success: { base: "$hue.green.200", muted: "$hue.green.300" },
        info: { base: "$hue.cyan.200", muted: "$hue.cyan.300" },
      },
    },
    background: {
      base: "#0e1620",
      raised: { base: "#16202c", high: "#1c2934", max: "#243341" },
      action: {
        primary: allStates("$hue.accent.400"),
        secondary: allStates("$hue.neutral.500"),
        destructive: allStates("$hue.red.400"),
      },
      formfield: allStates("$background.raised.base"),
      feedback: {
        error: { base: "$hue.red.700" },
        warning: { base: "$hue.yellow.700" },
        success: { base: "$hue.green.700" },
        info: { base: "$hue.cyan.700" },
      },
    },
    border: { base: "#24333f" },
    scrollbar: { base: "#24333f" },
    diff: {
      text: {
        added: "$hue.gray.300",
        removed: "$hue.gray.300",
        context: "$hue.gray.300",
        hunkHeader: "$hue.gray.300",
      },
      background: {
        added: "#163020",
        removed: "#2a1519",
        context: "$hue.gray.800",
      },
      highlight: { added: "$hue.green.300", removed: "$hue.red.300" },
      lineNumber: {
        text: "$text.muted",
        background: { added: "$diff.background.added", removed: "$diff.background.removed" },
      },
    },
    syntax: {
      comment: "$hue.gray.300",
      keyword: "$hue.cyan.300",
      function: "$hue.blue.300",
      variable: "$hue.gray.300",
      string: "$hue.green.300",
      number: "$hue.yellow.300",
      type: "$hue.purple.300",
      operator: "$hue.gray.300",
      punctuation: "$hue.gray.300",
    },
    markdown: {
      text: "$hue.gray.100",
      heading: "$hue.cyan.300",
      link: "$hue.interactive.300",
      linkText: "$hue.interactive.200",
      code: "$hue.green.300",
      blockQuote: "$hue.gray.400",
      emphasis: "$hue.gray.100",
      strong: "$hue.gray.100",
      horizontalRule: "$hue.gray.400",
      listItem: "$hue.gray.200",
      listEnumeration: "$hue.gray.300",
      image: "$hue.gray.300",
      imageText: "$hue.gray.200",
      codeBlock: "$hue.gray.100",
    },
  },
  modes: {
    dark: { hue: huesFor(DARK_RAMP) },
    light: {
      hue: huesFor(LIGHT_RAMP),
      tokens: {
        text: { base: "#1b2733", muted: "#586a7a" },
        background: {
          base: "#dbe3ea",
          raised: { base: "#cfd8e1", high: "#c8d2dc", max: "#c1cbd6" },
        },
        border: { base: "#b6c2ce" },
        scrollbar: { base: "#b6c2ce" },
        diff: { background: { added: "#d6e9dd", removed: "#f0d6d8" } },
      },
    },
  },
});

const fixture = () => buildTheme(spec());

test("a valid theme produces no errors", () => {
  const { ok, errors } = validateTheme(fixture());
  assert.deepEqual(errors, []);
  assert.equal(ok, true);
});

test("a null or undefined theme is reported, not thrown", () => {
  for (const input of [null, undefined]) {
    const { ok, errors } = validateTheme(input);
    assert.equal(ok, false, String(input));
    assert.ok(errors.some((e) => e.includes("[theme]")), `${String(input)}: ${errors.join("; ")}`);
  }
});

test("a missing token is named in the error", () => {
  const t = fixture();
  delete t.base.scrollbar;
  const { ok, errors } = validateTheme(t);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("scrollbar.base")), errors.join("\n"));
});

test("a bad hex value is named in the error", () => {
  const t = fixture();
  t.base.border.base = "#1234567";
  assert.ok(validateTheme(t).errors.some((e) => e.includes("border.base")));
});

test("a missing hue step is reported", () => {
  const t = fixture();
  delete t.dark.hue.red["400"];
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("dark") && e.includes("red") && e.includes("400")), errors.join("\n"));
});

test("an inverted dark ramp is reported", () => {
  const t = fixture();
  t.dark.hue.gray["100"] = "#000000";
  t.dark.hue.gray["900"] = "#ffffff";
  assert.ok(validateTheme(t).errors.some((e) => /direction/.test(e)));
});

test("light-mode muted text below 3:1 is reported", () => {
  const t = fixture();
  t.light.text.muted = t.light.background.base;
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("text.muted") && e.includes("light")), errors.join("\n"));
});

test("a syntax hue below 3:1 on the base background is reported", () => {
  const t = fixture();
  t.light.syntax.keyword = t.light.background.base;
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("syntax.keyword") && e.includes("light")), errors.join("\n"));
});

test("an unknown hue name in a value is reported", () => {
  const t = fixture();
  t.base.text.muted = "$hue.bogus";
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("text.muted") && e.includes("bogus")), errors.join("\n"));
});

test("an unknown hue step in a value is reported", () => {
  const t = fixture();
  t.base.syntax.keyword = "$hue.gray.123";
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("syntax.keyword") && e.includes("123")), errors.join("\n"));
});

test("categorical must be a non-empty list of hue names", () => {
  const empty = fixture();
  empty.base.categorical = [];
  assert.ok(validateTheme(empty).errors.some((e) => e.includes("categorical")));
  const bogus = fixture();
  bogus.base.categorical = ["accent", "nope"];
  assert.ok(validateTheme(bogus).errors.some((e) => e.includes("categorical") && e.includes("nope")));
});

test("an unresolvable contrast reference names the path and mode", () => {
  const t = fixture();
  t.light.text.muted = "$missing.token";
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("text.muted") && e.includes("light")), errors.join("\n"));
});

test("a non-hex hue step value is reported, not thrown", () => {
  const t = fixture();
  t.dark.hue.gray["400"] = "not-a-colour";
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("dark") && e.includes("gray") && e.includes("400")), errors.join("\n"));
});

test("an 8-digit hex token is shape-legal but reported as unmeasurable, not thrown", () => {
  const t = fixture();
  t.light.text.muted = "#586a7aff";
  const { errors } = validateTheme(t);
  // The wording discriminates: if check 2 ever rejected 8-digit hex, the message
  // would read "is not a colour" and this assertion would fail.
  assert.ok(
    errors.some((e) => e.includes("text.muted") && e.includes("8 digits") && e.includes("cannot measure")),
    errors.join("\n"),
  );
});

test("a 4-digit hex token is shape-legal but reported as unmeasurable, not thrown", () => {
  const t = fixture();
  t.light.text.muted = "#586a";
  const { errors } = validateTheme(t);
  assert.ok(
    errors.some((e) => e.includes("text.muted") && e.includes("4 digits") && e.includes("cannot measure")),
    errors.join("\n"),
  );
});

test("a hue step that resolves back to itself is reported, not a stack overflow", () => {
  const t = fixture();
  t.dark.hue.gray["500"] = "$hue.neutral.500";
  const { errors } = validateTheme(t);
  assert.ok(errors.some((e) => e.includes("gray") && e.includes("500")), errors.join("\n"));
});

test("a step on a whole-hue alias resolves to that hue's step", () => {
  const t = fixture();
  t.light.text.muted = "$hue.neutral.500";
  t.light.hue.gray["500"] = t.light.background.base;
  const { errors } = validateTheme(t);
  assert.ok(
    errors.some((e) => e.includes("light") && e.includes("text.muted") && e.includes("3:1")),
    errors.join("\n"),
  );
});

test("a step-qualified hue alias is reported, naming the hue and step", () => {
  const t = fixture();
  t.light.hue.accent = "$hue.cyan.400";
  const { errors } = validateTheme(t);
  assert.ok(
    errors.some((e) => e.includes("light") && e.includes("accent") && e.includes("400")),
    errors.join("\n"),
  );
});

test("a whole-hue reference in a colour position is reported", () => {
  const t = fixture();
  t.base.text.muted = "$hue.accent";
  const { errors } = validateTheme(t);
  assert.ok(
    errors.some((e) => e.includes("text.muted") && e.includes("whole-hue")),
    errors.join("\n"),
  );
});

test("a token reference in a syntax value is reported", () => {
  const t = fixture();
  t.base.syntax.keyword = "$text.muted";
  const { errors } = validateTheme(t);
  assert.ok(
    errors.some((e) => e.includes("syntax.keyword") && e.includes("syntax/markdown")),
    errors.join("\n"),
  );
});

test("transparent in a syntax value is reported", () => {
  const t = fixture();
  t.base.syntax.keyword = "transparent";
  const { errors } = validateTheme(t);
  assert.ok(
    errors.some((e) => e.includes("syntax.keyword") && e.includes("syntax/markdown")),
    errors.join("\n"),
  );
});

test("the contrast matrix is pinned to the approved floors and surfaces", () => {
  const surfaces = [
    "background.base",
    "background.raised.max",
    "diff.background.added",
    "diff.background.removed",
    "diff.background.context",
  ];
  const floors = [
    ["text.base", 4.5],
    ["text.muted", 3],
    ["syntax.comment", 3],
    ["syntax.keyword", 3],
    ["syntax.function", 3],
    ["syntax.variable", 3],
    ["syntax.string", 3],
    ["syntax.number", 3],
    ["syntax.type", 3],
    ["syntax.operator", 3],
    ["syntax.punctuation", 3],
    ["diff.text.added", 3],
    ["diff.text.removed", 3],
    ["diff.text.context", 3],
  ];
  const expected = floors.flatMap(([fg, min]) => surfaces.map((bg) => ({ fg, bg, min })));
  assert.deepEqual(CONTRAST_RULES, expected);
});
