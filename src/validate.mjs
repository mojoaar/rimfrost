// Theme validation: the gate between an assembled theme and dist/<name>.json.
//
// Five checks, in order, each naming the offending path and mode so a failure
// points at the token to retune rather than at the validator:
//
//   1. every contract token path resolves in the shared base and both modes;
//   2. every token leaf holds a value of the right type for its position — see
//      "three value types" below;
//   3. every mode defines all `HUES` at all nine steps, and every hue alias is a
//      whole-hue reference;
//   4. ramps run the right way: dark falls 100 -> 900, light rises;
//   5. the contrast matrix from the design spec holds in both modes.
//
// `validateTheme` takes a *built* theme (the `buildTheme` output), never a spec.
// Each `light`/`dark` section is a complete standalone tree, so checks 1 and 2
// read `theme.base` plus each mode directly and never re-merge.
//
// The three value types, from the loader (see
// docs/reference/opencode-theme-contract.md and the schema in the binary):
//
//   * a hue alias — a `modes.<mode>.hue.<name>` value — is either a nine-step
//     ramp object or a *whole-hue* reference `$hue.<name>`. The loader looks the
//     entire `/^\$hue\.(.+)$/` capture up in the hue map, so `$hue.cyan.400`
//     throws `Hue alias ... references a missing hue`. A step-qualified alias is
//     an error here for the same reason.
//   * a colour — any token under `text`/`background`/`border`/`scrollbar`/`diff`
//     — is `"transparent"`, a hex, a token reference `$<dotted.path>`, or a
//     *step-qualified* hue reference `$hue.<name>.<step>`. A bare whole-hue
//     reference is not a colour: the loader special-cases only
//     `hue.<name>.<step>`, so `$hue.accent` resolves to the whole ramp object and
//     throws `... is not a color`.
//   * a syntax/markdown value is stricter: a hex or a step-qualified hue
//     reference only. No `"transparent"`, no token reference.

import { HUES, tokenPaths, HEX_RE, TOKEN_REF_RE } from "./contract.mjs";
import { contrastRatio, relativeLuminance, hexToRgb } from "./color.mjs";

/**
 * The nine ramp steps. Declared here rather than imported: the contract module
 * keeps its own copy private to build the hue-reference regex, and the two are
 * not the same concern.
 */
const STEPS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

const MODES = ["light", "dark"];

/** `$hue.<name>` or `$hue.<name>.<step>` — a whole hue as well as one step. */
const HUE_VALUE_RE = /^\$hue\.([^.]+)(?:\.([^.]+))?$/;

/** syntax/markdown accept a narrower set than the other colour positions. */
const isSyntaxOrMarkdown = (path) => path.startsWith("syntax.") || path.startsWith("markdown.");

/**
 * The contrast floors from the design spec: body text, muted text, every syntax
 * hue and diff text, each measured against the base background, the highest
 * raised surface, and all three diff fills (added, removed, and the context
 * fill muted code and context text sit on). Exported so the test can state what
 * it expects the matrix to contain.
 *
 * @type {{fg: string, bg: string, min: number}[]}
 */
export const CONTRAST_RULES = [
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
].flatMap(([fg, min]) => [
  "background.base",
  "background.raised.max",
  "diff.background.added",
  "diff.background.removed",
  "diff.background.context",
].map((bg) => ({ fg, bg, min })));

/** Walk a dotted token path, tolerating the `@dialog` / `$hovered` segments. */
function lookup(tree, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), tree);
}

/**
 * Why a token leaf is not a usable value *for its position*, or `null` if it is.
 * Used by check 2, which is syntactic: it does not resolve references, only
 * their shape. `path` decides which of the three value types applies.
 */
function leafProblem(path, value) {
  if (typeof value !== "string") return "is not a colour";

  if (isSyntaxOrMarkdown(path)) {
    if (HEX_RE.test(value)) return null;
    const hue = HUE_VALUE_RE.exec(value);
    if (hue && hue[2] !== undefined) {
      if (!HUES.includes(hue[1])) return `references unknown hue "${hue[1]}"`;
      if (!STEPS.includes(hue[2])) return `references unknown hue step "${hue[2]}"`;
      return null;
    }
    // A whole-hue reference, a token reference, "transparent", or junk: the
    // loader's syntax/markdown type accepts a hex or a step-qualified hue
    // reference only.
    return `is not a syntax/markdown colour: ${value}`;
  }

  if (value === "transparent" || HEX_RE.test(value) || TOKEN_REF_RE.test(value)) return null;
  const hue = HUE_VALUE_RE.exec(value);
  if (!hue) return `is not a colour: ${value}`;
  if (!HUES.includes(hue[1])) return `references unknown hue "${hue[1]}"`;
  if (hue[2] === undefined) {
    return `is a whole-hue reference, but a colour needs a step ($hue.${hue[1]}.<step>)`;
  }
  if (!STEPS.includes(hue[2])) return `references unknown hue step "${hue[2]}"`;
  return null;
}

/**
 * Resolve a value to a hex colour: a literal, a hue reference (following
 * aliases, which may chain), or a token reference. Returns `{ hex }` or
 * `{ error }` — never `undefined`, so the contrast check reports a broken
 * reference instead of silently skipping the measurement.
 */
function resolveColor(tree, value, seen = new Set()) {
  if (typeof value !== "string") return { error: "is not a colour" };
  if (HEX_RE.test(value)) {
    // HEX_RE mirrors OpenCode's loader and admits 4- and 8-digit (alpha) hex,
    // which the contrast maths cannot parse. Report that rather than let
    // `hexToRgb` throw out of `relativeLuminance`/`contrastRatio`.
    try {
      hexToRgb(value);
    } catch {
      return { error: `is a hex with ${value.length - 1} digits, which the contrast maths cannot measure` };
    }
    return { hex: value };
  }
  if (value === "transparent") return { error: "is transparent, so it has no contrast" };

  const hue = HUE_VALUE_RE.exec(value);
  if (hue) {
    // A hue reference can recurse through a hue step (gray.500 = "$hue.neutral.500"),
    // so remember each request and report the cycle instead of overflowing.
    if (seen.has(value)) return { error: "has a circular hue reference" };
    seen.add(value);
    const [, name, step] = hue;
    if (!HUES.includes(name)) return { error: `references unknown hue "${name}"` };
    if (tree.hue?.[name] === undefined) return { error: `references missing hue "${name}"` };

    // Follow the alias chain to a real ramp *before* deciding, so a step asked
    // of an alias is honoured when the chain ends at a whole ramp, and reported
    // when a link pinned a single step.
    let hueName = name;
    let pinned;
    const aliases = new Set();
    while (typeof tree.hue[hueName] === "string") {
      const alias = tree.hue[hueName];
      if (aliases.has(alias)) return { error: "has a circular hue alias" };
      aliases.add(alias);
      const ref = HUE_VALUE_RE.exec(alias);
      if (!ref || !HUES.includes(ref[1])) return { error: `references an invalid hue alias: ${alias}` };
      if (ref[2] !== undefined) {
        if (step !== undefined) {
          return {
            error: `references hue "${name}" at step ${step}, but "${name}" aliases the single step ${ref[1]}.${ref[2]}`,
          };
        }
        pinned = ref[2];
      }
      hueName = ref[1];
      if (tree.hue[hueName] === undefined) return { error: `references missing hue "${hueName}"` };
    }

    const ramp = tree.hue[hueName];
    if (typeof ramp !== "object" || ramp === null) {
      return { error: `references hue "${hueName}" which is neither a ramp nor an alias` };
    }
    const resolvedStep = step ?? pinned;
    if (resolvedStep === undefined) return { error: `references hue "${name}" without a step` };
    if (typeof ramp[resolvedStep] !== "string") {
      return { error: `references missing hue step "${name}.${resolvedStep}"` };
    }
    return resolveColor(tree, ramp[resolvedStep], seen);
  }

  if (TOKEN_REF_RE.test(value)) {
    const path = value.slice(1);
    if (seen.has(value)) return { error: `has a circular token reference at "${path}"` };
    seen.add(value);
    const next = lookup(tree, path);
    if (next === undefined) return { error: `references missing token "${path}"` };
    return resolveColor(tree, next, seen);
  }

  return { error: `is not a colour: ${value}` };
}

/**
 * Validate a built theme. Pure: it reads the tree and returns findings, and
 * never throws on bad input.
 *
 * @param {{$schema: string, base: object, light: object, dark: object}} theme
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateTheme(theme) {
  // "Never throws on bad input" starts here: everything below dereferences the
  // tree, so a missing theme is reported rather than thrown.
  if (theme === null || typeof theme !== "object") {
    return { ok: false, errors: ["[theme] is not a theme object"] };
  }

  const errors = [];
  // The shared base plus both complete mode trees; each is checked on its own.
  const trees = [["base", theme.base], ...MODES.map((mode) => [mode, theme[mode]])];

  // 1 — completeness: everything in the contract resolves.
  for (const [label, tree] of trees) {
    for (const path of tokenPaths()) {
      if (lookup(tree, path) === undefined) errors.push(`[${label}] missing token ${path}`);
    }
  }

  // 2 — leaf shape: every token that exists holds a value legal in its
  // position (a colour, or the stricter syntax/markdown subtype).
  for (const [label, tree] of trees) {
    for (const path of tokenPaths()) {
      const value = lookup(tree, path);
      if (value === undefined) continue;
      const problem = leafProblem(path, value);
      if (problem) errors.push(`[${label}] ${path} ${problem}`);
    }
  }

  // `base.categorical` holds hue names, so it is validated on its own terms
  // rather than against the colour rules above.
  const categorical = theme.base?.categorical;
  if (!Array.isArray(categorical) || categorical.length === 0) {
    errors.push("[base] categorical must be a non-empty array of hue names");
  } else {
    for (const name of categorical) {
      if (!HUES.includes(name)) errors.push(`[base] categorical references unknown hue "${name}"`);
    }
  }

  // 3 — per mode, every hue at every step.
  for (const mode of MODES) {
    const tree = theme[mode];
    if (tree?.hue === undefined) {
      errors.push(`[${mode}] hue is missing`);
      continue;
    }
    for (const name of HUES) {
      const ramp = tree.hue[name];
      if (ramp === undefined) {
        errors.push(`[${mode}] hue ${name} is missing`);
        continue;
      }
      // A string is an alias; follow it (and any chain of aliases) to the ramp.
      // A hue alias must be a *whole-hue* reference: the loader looks the whole
      // `/^\$hue\.(.+)$/` capture up in the hue map, so a step-qualified alias
      // throws. The alias therefore never pins a step, and the target ramp must
      // be complete.
      let target = ramp;
      const seen = new Set();
      while (typeof target === "string") {
        const alias = HUE_VALUE_RE.exec(target);
        if (!alias || seen.has(target)) {
          errors.push(`[${mode}] hue ${name} has an invalid alias: ${target}`);
          target = undefined;
          break;
        }
        seen.add(target);
        if (alias[2] !== undefined) {
          errors.push(`[${mode}] hue ${name} aliases a single step (${target}); a hue alias must reference a whole hue`);
          target = undefined;
          break;
        }
        if (!HUES.includes(alias[1])) {
          errors.push(`[${mode}] hue ${name} aliases unknown hue "${alias[1]}"`);
          target = undefined;
          break;
        }
        target = tree.hue[alias[1]];
      }
      if (target === undefined) continue;
      if (target === null || typeof target !== "object") {
        errors.push(`[${mode}] hue ${name} is neither a ramp nor a hue alias`);
        continue;
      }
      for (const step of STEPS) {
        if (typeof target[step] !== "string") errors.push(`[${mode}] hue ${name} is missing step ${step}`);
      }
    }

    // 4 — direction is a property of the eight real ramps; the string aliases
    // are covered through the ramp they point at.
    for (const name of HUES) {
      const ramp = tree.hue[name];
      if (ramp === null || typeof ramp !== "object") continue;
      // Resolve each step through `resolveColor` so a non-measurable value is
      // reported against the hue, step and mode instead of throwing. A missing
      // step is already named by check 3, so it stays silent here.
      const lums = STEPS.map((step) => {
        if (typeof ramp[step] !== "string") return undefined;
        const resolved = resolveColor(tree, ramp[step]);
        if (resolved.error) {
          errors.push(`[${mode}] hue ${name} step ${step} ${resolved.error}`);
          return undefined;
        }
        return relativeLuminance(resolved.hex);
      });
      for (let i = 0; i < STEPS.length - 1; i += 1) {
        if (lums[i] === undefined || lums[i + 1] === undefined) continue;
        const ordered = mode === "dark" ? lums[i] > lums[i + 1] : lums[i] < lums[i + 1];
        if (!ordered) {
          errors.push(
            `[${mode}] hue ${name} direction is wrong: ${STEPS[i]} (${ramp[STEPS[i]]}) should be `
            + `${mode === "dark" ? "lighter" : "darker"} than ${STEPS[i + 1]} (${ramp[STEPS[i + 1]]})`,
          );
        }
      }
    }
  }

  // 5 — the contrast matrix, resolved and measured per mode.
  for (const mode of MODES) {
    const tree = theme[mode];
    if (tree === undefined) continue;
    for (const rule of CONTRAST_RULES) {
      const fg = resolveColor(tree, lookup(tree, rule.fg));
      if (fg.error) {
        errors.push(`[${mode}] ${rule.fg} ${fg.error}`);
        continue;
      }
      const bg = resolveColor(tree, lookup(tree, rule.bg));
      if (bg.error) {
        errors.push(`[${mode}] ${rule.bg} ${bg.error}`);
        continue;
      }
      const ratio = contrastRatio(fg.hex, bg.hex);
      if (ratio < rule.min) {
        errors.push(`[${mode}] ${rule.fg} on ${rule.bg} is ${ratio.toFixed(2)}:1, needs ${rule.min}:1`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
