// Palette tests for all four themes. fjord was the flagship and the only
// palette originally covered here; ravn, nordlys and skumring were authored
// inline from fjord as a template, so every shared assertion below runs over
// all four and names the palette (and mode) when it fails.
//
// Assertions that encode fjord's *own* character rather than a pack invariant
// are marked as such and stay fjord-only.

import test from "node:test";
import assert from "node:assert/strict";
import fjord from "../src/palettes/fjord.mjs";
import ravn from "../src/palettes/ravn.mjs";
import nordlys from "../src/palettes/nordlys.mjs";
import skumring from "../src/palettes/skumring.mjs";
import { buildTheme } from "../src/theme.mjs";
import { validateTheme } from "../src/validate.mjs";
import { tokenPaths } from "../src/contract.mjs";
import { hexToRgb, srgbToOklab, contrastRatio } from "../src/color.mjs";

const L = (hex) => srgbToOklab(hexToRgb(hex)).L;
const lab = (hex) => srgbToOklab(hexToRgb(hex));
const chroma = (hex) => {
  const { a, b } = lab(hex);
  return Math.hypot(a, b);
};

/** The four hand-authored palettes, named, in authoring order. */
const PALETTES = [
  ["fjord", fjord],
  ["ravn", ravn],
  ["nordlys", nordlys],
  ["skumring", skumring],
];

/** The hue each palette's signature `accent` aliases (both modes). */
const ACCENT_HUE = { fjord: "cyan", ravn: "purple", nordlys: "green", skumring: "blue" };

const theme = (spec) => buildTheme(spec);

/**
 * Per-theme OKLab chroma ceiling. This is a character bound, not a pack
 * invariant, so it is stated per theme rather than applied blindly.
 *
 * Reference chroma, for scale: amber #ff8800 is 0.181, pure red #ff0000 is
 * 0.258. fjord, ravn and skumring keep every ramp step under 0.12 (measured
 * maxima: fjord 0.1010, ravn 0.1158, skumring 0.0655). nordlys is deliberately
 * the most saturated of the four — its darkest purple.500 (#7459b3) measures
 * 0.1377 — so it gets its own ceiling rather than having an approved anchor
 * retuned to satisfy the others'.
 */
const CHROMA_CEILING = { fjord: 0.12, ravn: 0.12, nordlys: 0.14, skumring: 0.12 };

/** Walk a dotted token path the way the theme loader would. */
function at(tree, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), tree);
}

/**
 * Resolve a theme value the way OpenCode does: `$hue.<name>.<step>` is that
 * mode's step, following whole-hue aliases (`accent` -> `cyan`); `$<token.path>`
 * walks the mode's merged tree. A bare whole-hue reference is not a colour and
 * must never reach here.
 */
function resolve(t, mode, ref) {
  if (ref.startsWith("$hue.")) {
    const [name, step] = ref.slice("$hue.".length).split(".");
    assert.ok(step !== undefined, `${ref} is a whole-hue reference, not a colour`);
    let ramp = t[mode].hue[name];
    while (typeof ramp === "string") {
      const [target] = ramp.slice("$hue.".length).split(".");
      ramp = t[mode].hue[target];
    }
    return ramp[step];
  }
  return at(t[mode], ref.slice(1));
}

test("dark runs light to dark, light runs dark to light", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    assert.ok(L(t.dark.hue.gray["100"]) > L(t.dark.hue.gray["900"]), `${name} dark`);
    assert.ok(L(t.light.hue.gray["100"]) < L(t.light.hue.gray["900"]), `${name} light`);
  }
});

test("every syntax hue is a distinct colour in both modes", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    for (const mode of ["dark", "light"]) {
      const syntax = t[mode].syntax;
      const seen = new Map();
      for (const k of Object.keys(syntax)) {
        const v = resolve(t, mode, syntax[k]);
        assert.ok(!seen.has(v), `${name} ${mode}: ${k} and ${seen.get(v)} are both ${v}`);
        seen.set(v, k);
      }
    }
  }
});

test("each palette aliases its signature hue and shares the common aliases", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    // The accent aliases the hue in both modes; the step is chosen per reference
    // site, so the alias itself is always whole-hue.
    for (const mode of ["dark", "light"]) {
      assert.equal(t[mode].hue.accent, `$hue.${ACCENT_HUE[name]}`, `${name} ${mode} accent`);
      assert.equal(t[mode].hue.interactive, "$hue.blue", `${name} ${mode} interactive`);
      assert.equal(t[mode].hue.neutral, "$hue.gray", `${name} ${mode} neutral`);
    }
  }
});

test("each palette validates: the palette and the validator agree", () => {
  for (const [name, spec] of PALETTES) {
    assert.deepEqual(validateTheme(buildTheme(spec)), { ok: true, errors: [] }, name);
  }
});

test("no colour value in any built theme is a whole-hue reference", () => {
  const wholeHue = /^\$hue\.[^.]+$/;
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    for (const mode of ["dark", "light"]) {
      for (const path of tokenPaths()) {
        const value = at(t[mode], path);
        assert.ok(
          !wholeHue.test(value),
          `${name} ${mode} ${path} = ${value} is a whole-hue reference, not a colour`,
        );
      }
    }
  }
});

test("the action groups resolve to measurable colours in both modes", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    for (const mode of ["dark", "light"]) {
      for (const group of ["text", "background"]) {
        for (const action of ["primary", "secondary", "destructive"]) {
          for (const [state, value] of Object.entries(at(t[mode], `${group}.action.${action}`))) {
            // An action surface may be transparent — the platform's own themes
            // paint it that way. Anything else must be a real colour, never a
            // whole-hue reference.
            if (value === "transparent") continue;
            assert.match(
              resolve(t, mode, value),
              /^#[\da-f]{6}$/i,
              `${name} ${mode} ${group}.action.${action}.${state}`,
            );
          }
        }
      }
    }
  }
});

// The `/` picker paints its cursor row with the action's hovered background and
// the base text on top. Binding both to the same accent step made that row
// unreadable; this pins the row, not just the token shapes.
test("the cursor row is readable, hovered and focused", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    for (const mode of ["dark", "light"]) {
      for (const action of ["primary", "secondary", "destructive"]) {
        const fill = resolve(t, mode, at(t[mode], `background.action.${action}`).$hovered);
        const ratio = contrastRatio(resolve(t, mode, "$text.base"), fill);
        assert.ok(ratio >= 4.5, `${name} ${mode} ${action} row is ${ratio.toFixed(2)}:1 on ${fill}`);

        // Focused is the row the cursor is actually on: bright fill, inverted text.
        const focusFill = resolve(t, mode, at(t[mode], `background.action.${action}`).$focused);
        const focusText = resolve(t, mode, at(t[mode], `text.action.${action}`).$focused);
        const focusRatio = contrastRatio(focusText, focusFill);
        assert.ok(
          focusRatio >= 4.5,
          `${name} ${mode} ${action} focused row is ${focusRatio.toFixed(2)}:1 (${focusText} on ${focusFill})`,
        );
      }
    }
  }
});

// fjord-only: these are fjord's own approved hexes, not a pack invariant. The
// other three themes have their own approved anchors (pinned by the design
// spec), so there is nothing self-referential to loop here.
test("fjord's approved anchor values are preserved exactly", () => {
  const t = theme(fjord);
  assert.equal(t.dark.hue.cyan["300"], "#6fc4cd");
  assert.equal(t.dark.hue.cyan["900"], "#0a1d20");
  assert.equal(t.light.hue.gray["900"], "#dbe3ea");
  assert.equal(t.base.background.base, "#0e1620");
});

test("light mode overrides text.muted to clear the contrast floor", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    assert.notEqual(t.light.text.muted, t.dark.text.muted, `${name} light`);
  }
});

test("no palette step is more vivid than its theme allows", () => {
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    const ceiling = CHROMA_CEILING[name];
    for (const mode of ["dark", "light"]) {
      for (const [hue, steps] of Object.entries(t[mode].hue)) {
        // accent/interactive/neutral are alias strings, not ramps; each points at
        // a base hue already walked here, so there is nothing new to measure.
        if (typeof steps === "string") continue;
        for (const [step, hex] of Object.entries(steps)) {
          const c = chroma(hex);
          assert.ok(
            c < ceiling,
            `${name} ${mode} ${hue}.${step} ${hex} chroma ${c.toFixed(3)} >= ${ceiling}`,
          );
        }
      }
    }
  }
});

// fjord-only: negative a and b in every gray step is fjord's documented
// blue-violet lean — the theme's own character, not a pack invariant. It is
// false for ravn light (a > 0) and nordlys light (b > 0), so it is labelled as
// fjord's identity rather than enforced on the other three. The pack-wide
// neutral check below is the one that covers all four.
test("fjord's neutrals lean cold, the documented blue-violet direction", () => {
  const t = theme(fjord);
  for (const mode of ["dark", "light"]) {
    for (const [step, hex] of Object.entries(t[mode].hue.gray)) {
      const { a, b } = lab(hex);
      assert.ok(a < 0 && b < 0, `${mode} gray.${step} ${hex} leans warm (a ${a.toFixed(4)}, b ${b.toFixed(4)})`);
    }
  }
});

// Pack-wide neutral check. Measured maximum OKLab chroma over every gray step,
// both modes: fjord 0.0359 (dark gray.500), ravn 0.0320 (dark gray.500),
// nordlys 0.0596 (dark gray.500), skumring 0.0281 (dark gray.500). The 0.07
// bound therefore holds with clear margin while still failing if a neutral
// drifts toward a chromatic hue.
test("all four palettes' neutrals are near-neutral", () => {
  const NEUTRAL_CEILING = 0.07;
  for (const [name, spec] of PALETTES) {
    const t = theme(spec);
    for (const mode of ["dark", "light"]) {
      for (const [step, hex] of Object.entries(t[mode].hue.gray)) {
        const c = chroma(hex);
        assert.ok(
          c < NEUTRAL_CEILING,
          `${name} ${mode} gray.${step} ${hex} chroma ${c.toFixed(4)} >= ${NEUTRAL_CEILING}`,
        );
      }
    }
  }
});
