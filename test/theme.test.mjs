import test from "node:test";
import assert from "node:assert/strict";
import { buildTheme, DIALOG_DEFAULT } from "../src/theme.mjs";
import { HUES, HUE_REF_RE, tokenPaths } from "../src/contract.mjs";

// Two anchor ramps per mode, reused across the hue names, so this suite never
// depends on fjord (Task 5) and builds in microseconds. The three aliases are
// strings, which is what exercises the alias branch of the assembly.
const GRAY_DARK = { 100: "#e6ecf2", 300: "#aebfcd", 500: "#7d90a3", 700: "#3a4b5a", 900: "#0e1620" };
const CYAN_DARK = { 100: "#cbf0f2", 300: "#6fc4cd", 500: "#358892", 700: "#1c4c53", 900: "#0a1d20" };
const GRAY_LIGHT = { 100: "#202c38", 300: "#4a5a6b", 500: "#7b8b9c", 700: "#b3c0cc", 900: "#dbe3ea" };
const CYAN_LIGHT = { 100: "#0d3540", 300: "#22646f", 500: "#3f95a2", 700: "#a3d0d7", 900: "#d3e8ec" };

const STEPS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
const STATES = ["base", "$hovered", "$focused", "$pressed", "$selected", "$disabled"];

const allStates = (value) => Object.fromEntries(STATES.map((state) => [state, value]));

function huesFor(gray, chrome) {
  return {
    gray,
    red: chrome,
    orange: chrome,
    yellow: chrome,
    green: chrome,
    cyan: chrome,
    blue: chrome,
    purple: chrome,
    accent: "$hue.cyan",
    interactive: "$hue.blue",
    neutral: "$hue.gray",
  };
}

function fixture() {
  return {
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
          added: "$hue.green.200",
          removed: "$hue.red.200",
          context: "$hue.gray.400",
          hunkHeader: "$hue.gray.500",
        },
        background: {
          added: "#163020",
          removed: "#2a1519",
          context: "$hue.gray.800",
        },
        highlight: { added: "$hue.green.300", removed: "$hue.red.300" },
        lineNumber: {
          text: "$hue.gray.500",
          background: { added: "#1b2b34", removed: "#2d1f26" },
        },
      },
      syntax: {
        comment: "$hue.gray.500",
        keyword: "$hue.cyan.300",
        function: "$hue.blue.300",
        variable: "$hue.gray.100",
        string: "$hue.green.300",
        number: "$hue.yellow.300",
        type: "$hue.purple.300",
        operator: "$hue.gray.500",
        punctuation: "$hue.gray.400",
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
        horizontalRule: "$hue.gray.500",
        listItem: "$hue.gray.200",
        listEnumeration: "$hue.gray.300",
        image: "$hue.interactive.300",
        imageText: "$hue.gray.200",
        codeBlock: "$hue.gray.100",
      },
    },
    modes: {
      dark: { hue: huesFor(GRAY_DARK, CYAN_DARK), tokens: { text: { muted: "#8ba0b5" } } },
      light: { hue: huesFor(GRAY_LIGHT, CYAN_LIGHT) },
    },
  };
}

/** Walk a dotted token path the way the theme loader would. */
function at(tree, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), tree);
}

test("the built theme defines every path in the contract", () => {
  const out = buildTheme(fixture());
  assert.equal(out.$schema, "https://opencode.ai/theme.json");
  for (const mode of ["dark", "light"]) {
    for (const path of tokenPaths()) {
      assert.notEqual(at(out.base, path), undefined, `base is missing ${path}`);
      assert.notEqual(at(out[mode], path), undefined, `${mode} is missing ${path}`);
    }
  }
});

test("both modes define all 11 hues at all 9 steps", () => {
  const out = buildTheme(fixture());
  for (const mode of ["dark", "light"]) {
    const hues = out[mode].hue;
    for (const name of HUES) {
      assert.ok(name in hues, `${mode}.hue is missing ${name}`);
      const value = hues[name];
      if (typeof value === "string") {
        assert.match(value, HUE_REF_RE, `${mode}.hue.${name} is not a hue reference`);
        const [target, step] = value.slice("$hue.".length).split(".");
        // A hue alias must be whole-hue: the loader looks the whole capture up
        // in the hue map, so a step-qualified alias is not a legal alias.
        assert.equal(step, undefined, `${mode}.hue.${name} aliases a single step`);
        const ramp = hues[target];
        assert.ok(ramp, `${mode}.hue.${name} aliases missing hue ${target}`);
        for (const s of STEPS) assert.equal(typeof ramp[s], "string", `${mode}.hue.${target}.${s}`);
      } else {
        for (const s of STEPS) assert.equal(typeof value[s], "string", `${mode}.hue.${name}.${s}`);
      }
    }
  }
});

test("a missing hue is reported by name", () => {
  const spec = fixture();
  delete spec.modes.dark.hue.neutral;
  assert.throws(() => buildTheme(spec), /neutral/);
});

test("token references survive assembly untouched", () => {
  const out = buildTheme(fixture());
  assert.equal(out.base.syntax.keyword, "$hue.cyan.300");
  assert.equal(out.base.markdown.codeBlock, "$hue.gray.100");
  assert.equal(out.light.syntax.keyword, "$hue.cyan.300");
});

test("mode token overrides win over base", () => {
  const out = buildTheme(fixture());
  assert.equal(out.base.text.muted, "#7d90a3");
  assert.equal(out.dark.text.muted, "#8ba0b5");
  assert.equal(out.light.text.muted, "#7d90a3");
  assert.equal(out.dark.text.base, "#c6d4e0", "an override deep-merges, it does not replace the group");
});

test("categorical lands in base", () => {
  const out = buildTheme(fixture());
  assert.deepEqual(out.base.categorical, ["accent", "cyan", "blue", "purple"]);
});

test("the @dialog default is present", () => {
  const out = buildTheme(fixture());
  assert.deepEqual(out.base["@dialog"], DIALOG_DEFAULT);
  assert.equal(out.base["@dialog"].background.base, "$background.raised.base");
  assert.equal(out.base["@dialog"].background.action.primary.$hovered, "$background.raised.high");
});
