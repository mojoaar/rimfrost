// Theme assembly: a hand-authored palette spec becomes the complete theme file
// object that the validator checks and the build writes to dist/<name>.json.
//
// The file shape is pinned by docs/reference/opencode-theme-contract.md: one
// `base` token tree shared by both modes, plus a `light` and a `dark` section.
// Each mode inherits the file's own base — never the other mode, never
// OpenCode's built-ins — so this module clones `base` per mode and layers that
// mode's overrides over the clone.

import { readFileSync } from "node:fs";
import { expandRamp } from "./ramp.mjs";
import { HUES } from "./contract.mjs";

/**
 * The `@dialog` override a built-in theme ships with, copied from
 * docs/reference/opencode-theme-contract.md. Exported rather than inlined in
 * both modes so there is one place to retune it.
 */
export const DIALOG_DEFAULT = {
  background: {
    base: "$background.raised.base",
    action: { primary: { $hovered: "$background.raised.high" } },
  },
};

/** Cosmetic: the documented schema URL 404s, so this is for readers only. */
const SCHEMA = "https://opencode.ai/theme.json";

/** The pack version, so an installed theme file says which release it came from. */
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Recursively layer `overrides` onto `target`, replacing leaves. */
function merge(target, overrides) {
  for (const [key, value] of Object.entries(overrides)) {
    target[key] = isPlainObject(value) && isPlainObject(target[key])
      ? merge(target[key], value)
      : structuredClone(value);
  }
  return target;
}

/**
 * Turn a palette spec into a complete theme file object.
 *
 * @param {object} spec the shape Tasks 5 and 7 author and consume
 * @returns {{$schema: string, version: string, base: object, light: object, dark: object}}
 */
export function buildTheme(spec) {
  const base = structuredClone(spec.base);
  base.categorical = [...spec.categorical];
  base["@dialog"] = structuredClone(DIALOG_DEFAULT);

  return {
    $schema: SCHEMA,
    version: VERSION,
    base,
    light: buildMode("light", spec.modes.light, base),
    dark: buildMode("dark", spec.modes.dark, base),
  };
}

/**
 * One mode: its hue map, then the inherited base tree with the mode's token
 * overrides merged on top. `hue` leads so the emitted file reads sensibly.
 */
function buildMode(name, mode, base) {
  const hue = {};
  for (const hueName of HUES) {
    const value = mode.hue?.[hueName];
    if (value === undefined) throw new Error(`Missing hue "${hueName}" in ${name}`);
    // A string is an alias for another hue (`$hue.cyan`, `$hue.cyan.400`);
    // expandRamp only accepts the five-anchor object.
    hue[hueName] = typeof value === "string" ? value : expandRamp(value);
  }
  return { hue, ...merge(structuredClone(base), mode.tokens ?? {}) };
}
