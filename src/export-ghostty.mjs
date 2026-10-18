// Ghostty export: turn the built themes into the sixteen-colour palettes a
// terminal loads, one file per theme per mode:
//
//   ghostty/dist/<Name>        the dark palette
//   ghostty/dist/<Name> Light  the light one
//
// The input is the theme JSON the *OpenCode* target already ships
// (`opencode/dist/<name>.json`), not a fresh build: `buildAll` has validated it
// by then, and reading it back means all four targets map the same bytes. That
// is why `npm run export` chains the exporters with `&&` — these have nothing
// to read unless `export.mjs` ran first.
//
// The mapping is data, not branches. Slots 1–6 are in ANSI order, and there is
// no mode branch: the ramps already flip direction, so `.300` is the normal
// colour and `.200` the bright one in both modes. ANSI has no orange slot, so
// the pack's orange is the one colour that does not reach a terminal.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Slots 1–6, then the brights 9–14, in ANSI order. No orange: ANSI has no slot for it. */
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];

/** The sixteen palette slots as `[hue, step]`, in ANSI order. */
const SLOTS = [
  ["gray", "900"],
  ...CHROMATIC.map((hue) => [hue, "300"]),
  ["gray", "300"],
  ["gray", "600"],
  ...CHROMATIC.map((hue) => [hue, "200"]),
  ["gray", "100"],
];

/** A hue entry is either a ramp or a whole-hue alias; follow the alias to the ramp. */
const ramp = (tree, name) =>
  typeof tree.hue[name] === "string"
    ? ramp(tree, tree.hue[name].replace("$hue.", "").split(".")[0])
    : tree.hue[name];

/** `fjord` → `Fjord`: a Ghostty theme file is the theme name, capitalised. */
const cap = (name) => name[0].toUpperCase() + name.slice(1);

/**
 * One mode of one theme as a Ghostty theme file's body: sixteen palette slots
 * then six named keys, and a closing newline like every other generated file.
 */
export function ghosttyTheme(theme, mode) {
  const tree = theme[mode];
  const lines = [
    ...SLOTS.map(([hue, step], index) => `palette = ${index}=${ramp(tree, hue)[step]}`),
    `background = ${tree.background.base}`,
    `foreground = ${tree.text.base}`,
    `cursor-color = ${ramp(tree, "accent")["300"]}`,
    `cursor-text = ${tree.background.base}`,
    `selection-background = ${tree.background.raised.high}`,
    `selection-foreground = ${tree.text.base}`,
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Write every theme in `themesDir` out as both of its Ghostty palettes.
 *
 * @param {{themesDir: string, outDir: string}} options
 * @returns {{themes: string[], errors: string[]}} `themes` is the theme names
 *   written, `errors` is one `"<name>: <message>"` entry per problem.
 */
export function exportGhostty({ themesDir, outDir }) {
  mkdirSync(outDir, { recursive: true });

  const names = readdirSync(themesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();

  const themes = [];
  const errors = [];

  for (const name of names) {
    try {
      const theme = JSON.parse(readFileSync(join(themesDir, `${name}.json`), "utf8"));
      const base = cap(name);
      writeFileSync(join(outDir, base), ghosttyTheme(theme, "dark"));
      writeFileSync(join(outDir, `${base} Light`), ghosttyTheme(theme, "light"));
      themes.push(name);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  return { themes, errors };
}

/** CLI entry: map what `export.mjs` just wrote into the ghostty target's folder. */
function main() {
  const { themes, errors } = exportGhostty({
    themesDir: join(PROJECT_ROOT, "opencode", "dist"),
    outDir: join(PROJECT_ROOT, "ghostty", "dist"),
  });

  for (const name of themes) console.log(`${name}: exported`);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

// Only run when invoked as a script; the tests import `exportGhostty` directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
