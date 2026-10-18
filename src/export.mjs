// Export: turn the built themes into token files a consumer *outside* OpenCode
// can use — a web app, a docs site, a design tool.
//
// `npm run export` writes the theme files into the opencode target's folder and,
// one folder over, the tokens a web app reads:
//
//   web/dist/tokens/tokens.json   every theme, both modes, plus the version
//   web/dist/tokens/<name>.css    the same values as CSS custom properties
//
// The CSS is the artifact a web developer pastes: one property name, defined
// once per mode, so flipping `data-theme` re-themes the page. Dark is also on
// `:root` so a page that does nothing gets a complete theme.
//
// Values are read from the *built* themes that `buildAll` writes (it has already
// validated them), so this file has no loader of its own beyond resolving the
// references — see `resolve` below.
//
// State keys (`$hovered`, `$focused`, …) are OpenCode's interaction model and are
// dropped; so are `hue` aliases (a mechanism, not a colour) and `categorical`
// (OpenCode picks the steps, and inventing them here would be a colour decision
// nobody made). Ramps are exported in full, since a web app wants those.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAll } from "./build.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MODES = ["dark", "light"];
const HEX6_RE = /^#[\da-f]{6}$/i;
const HUE_VALUE_RE = /^\$hue\.([^.]+)(?:\.([^.]+))?$/;

/** The keys a mode tree holds that are not colours: OpenCode's own machinery. */
const SKIP = (key) => key.startsWith("$") || key.startsWith("@") || key === "categorical" || key === "hue";

/**
 * Resolve one value to a hex, following hue aliases and token references.
 * This is the second resolver in the project — `validate.mjs`'s is private —
 * and the two must agree on the value types.
 *
 * shortcut: duplicate resolver, extract to a shared module if a third consumer appears.
 *
 * Throws on anything it cannot resolve: `buildAll` has already validated the
 * theme, so a failure here is a bug in this function, not bad palette data.
 */
function resolve(tree, value) {
  if (value === "transparent") return value;
  if (HEX6_RE.test(value)) return value.toLowerCase();

  const hue = HUE_VALUE_RE.exec(value);
  if (hue) {
    const [, name, step] = hue;
    // Follow the alias chain to a real ramp before reading a step. No cycle
    // guard: the validator rejects circular aliases before we get here.
    let hueName = name;
    let pinned;
    while (typeof tree.hue?.[hueName] === "string") {
      const ref = HUE_VALUE_RE.exec(tree.hue[hueName]);
      hueName = ref[1];
      pinned ??= ref[2];
    }
    const ramp = tree.hue?.[hueName];
    const key = step ?? pinned;
    if (typeof ramp?.[key] !== "string") throw new Error(`cannot resolve ${value}`);
    return resolve(tree, ramp[key]);
  }

  if (value.startsWith("$")) {
    const path = value.slice(1);
    const target = path.split(".").reduce((node, key) => node?.[key], tree);
    if (target === undefined) throw new Error(`cannot resolve ${value}`);
    return resolve(tree, target);
  }

  throw new Error(`cannot resolve ${value}`);
}

/** Walk a mode tree, returning `{ "text.base": "#c6d4e0", … }` for its leaves. */
function flatten(tree, node = tree, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    if (SKIP(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = resolve(tree, value);
    else if (value && typeof value === "object") flatten(tree, value, path, out);
  }
  return out;
}

/** One hue's nine resolved steps, following an alias to the ramp it points at. */
function rampSteps(tree, name) {
  const value = tree.hue?.[name];
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([step, stepValue]) => [step, resolve(tree, stepValue)]));
  }
  // An alias, whole-hue or pinned to one step. Aliases are part of the exported
  // API (`--fjord-accent-300` is how the theme actually uses cyan), so they get
  // a ramp too. No cycle guard: the validator rejects circular aliases first.
  const [, target] = HUE_VALUE_RE.exec(value ?? "") ?? [];
  return target === undefined ? null : rampSteps(tree, target);
}

/** The eleven ramps — every `HUES` name, aliases resolved to the ramp they name. */
function rampsOf(tree) {
  const ramps = {};
  for (const name of Object.keys(tree.hue ?? {})) {
    const steps = rampSteps(tree, name);
    if (steps !== null) ramps[name] = steps;
  }
  return ramps;
}

/** One theme's two mode blocks, as `{ dark: { "text-base": "#…" }, light: {…} }`. */
function properties(theme) {
  const out = {};
  for (const mode of MODES) {
    const tree = theme[mode];
    const ramp = rampsOf(tree);
    out[mode] = {
      ...Object.fromEntries(Object.entries(flatten(tree)).map(([path, value]) => [path.replaceAll(".", "-"), value])),
      ...Object.fromEntries(
        Object.entries(ramp).flatMap(([name, steps]) => Object.entries(steps).map(([step, value]) => [`${name}-${step}`, value])),
      ),
    };
  }
  return out;
}

/** The CSS a web app pastes: one variable name, redefined per mode. */
function toCss(name, props) {
  const block = (selector, data) =>
    `${selector} {\n${Object.entries(data).map(([key, value]) => `  --${name}-${key}: ${value};`).join("\n")}\n}`;
  return [
    `/* ${name} — generated by src/export.mjs; edit the palette, not this file. */`,
    "",
    block(`:root,\n[data-theme="${name}-dark"]`, props.dark),
    "",
    block(`[data-theme="${name}-light"]`, props.light),
    "",
  ].join("\n");
}

/**
 * Build and export every palette in `palettesDir`.
 *
 * `outDir` is the build directory (the same one `node src/build.mjs` fills): the
 * theme files are written there as a side effect. The token files land in
 * `tokensDir`, which defaults to `<outDir>/tokens`; the CLI points it at another
 * target's folder, so each target's output stays under its own folder.
 *
 * @param {{palettesDir: string, outDir: string, tokensDir?: string}} options
 * @returns {{themes: string[], errors: string[]}} `errors` is one
 *   `"<name>: <message>"` entry per palette that failed to build or export.
 */
export function exportAll({ palettesDir, outDir, tokensDir = join(outDir, "tokens") }) {
  const { built, errors } = buildAll({ palettesDir, outDir });
  mkdirSync(tokensDir, { recursive: true });

  const { version } = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
  const themes = {};
  const exported = [];

  for (const name of built) {
    try {
      const theme = JSON.parse(readFileSync(join(outDir, `${name}.json`), "utf8"));
      const props = properties(theme);
      for (const mode of MODES) validateKeys(name, mode, props[mode]);
      themes[name] = Object.fromEntries(
        MODES.map((mode) => [mode, { tokens: flatten(theme[mode]), ramps: rampsOf(theme[mode]) }]),
      );
      writeFileSync(join(tokensDir, `${name}.css`), toCss(name, props));
      exported.push(name);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  writeFileSync(join(tokensDir, "tokens.json"), `${JSON.stringify({ version, themes }, null, 2)}\n`);
  return { themes: exported, errors };
}

/** Nothing may leave here as a non-colour: a bug in `resolve` must be loud. */
function validateKeys(name, mode, props) {
  for (const [key, value] of Object.entries(props)) {
    if (!(HEX6_RE.test(value) || value === "transparent")) {
      throw new Error(`${mode} ${key} resolved to ${JSON.stringify(value)}`);
    }
  }
}

/** CLI entry: export the real palettes into each target's folder, exiting 1 on any failure. */
function main() {
  const { themes, errors } = exportAll({
    palettesDir: join(PROJECT_ROOT, "src", "palettes"),
    outDir: join(PROJECT_ROOT, "opencode", "dist"),
    tokensDir: join(PROJECT_ROOT, "web", "dist", "tokens"),
  });

  for (const name of themes) console.log(`${name}: exported`);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

// Only run when invoked as a script; the tests import `exportAll` directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
