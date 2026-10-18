// The Windows Terminal target: one fragment holding one colour scheme.
//
// The input is the theme JSON the OpenCode target already ships
// (`opencode/dist/<name>.json`), not the palettes — that is why `npm run export`
// chains the exporters with `&&`, and why every terminal target carries the same
// bytes. Reading a built file is also why `hue.accent` here is a string to follow
// before it can be indexed by step.
//
// The mapping is data, not branches, and there is no mode branch: the ramps
// already flip, so `.300` is the normal ANSI colour and `.200` the bright one in
// both modes. Windows Terminal names the pack's purple `purple`; there is no
// orange slot.
//
// The file is a fragment — `{ "schemes": [ … ] }` — which Windows Terminal reads
// out of its Fragments directory. The light/dark pairing lives on the profile,
// not on the scheme, so the README documents the two-line paste that switches
// between the two files this writes.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The pack's purple is Windows Terminal's purple. */
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
/** Windows Terminal's names for the eight roles in each half of the palette. */
const ANSI = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
/** The sixteen key names: the plain half lower case, the bright half camel. */
const KEYS = [...ANSI, ...ANSI.map((name) => `bright${name[0].toUpperCase()}${name.slice(1)}`)];
/** The sixteen slots in ANSI order: the plain half, then the bright half. */
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

const cap = (name) => name[0].toUpperCase() + name.slice(1);

/**
 * One theme in one mode, as a Windows Terminal fragment.
 *
 * No mode branch: the ramps already flip, so `.300` is the normal ANSI colour
 * and `.200` the bright one in both modes, exactly as in the Ghostty file.
 *
 * @param {object} theme a built theme file
 * @param {"dark"|"light"} mode
 * @param {string} name the theme's name, lower case as the file names it
 * @returns {string}
 */
export function windowsterminalScheme(theme, mode, name) {
  const tree = theme[mode];
  const label = mode === "light" ? `${cap(name)} Light` : cap(name);
  const scheme = {
    name: label,
    ...Object.fromEntries(
      SLOTS.map(([hue, at], index) => [KEYS[index], ramp(tree, hue)[at]]),
    ),
    background: tree.background.base,
    foreground: tree.text.base,
    cursorColor: ramp(tree, "accent")["300"],
    selectionBackground: tree.background.raised.high,
  };
  return `${JSON.stringify({ schemes: [scheme] }, null, 2)}\n`;
}

/**
 * Write every built theme as a Windows Terminal fragment, one per mode.
 *
 * @param {{themesDir: string, outDir: string}} paths
 * @returns {{themes: string[], errors: string[]}}
 */
export function exportWindowsterminal({ themesDir, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const themes = [];
  const errors = [];
  const names = readdirSync(themesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();

  for (const name of names) {
    try {
      const theme = JSON.parse(readFileSync(join(themesDir, `${name}.json`), "utf8"));
      writeFileSync(join(outDir, `${cap(name)}.json`), windowsterminalScheme(theme, "dark", name));
      writeFileSync(join(outDir, `${cap(name)} Light.json`), windowsterminalScheme(theme, "light", name));
      themes.push(name);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  return { themes, errors };
}

function main() {
  const { themes, errors } = exportWindowsterminal({
    themesDir: join(PROJECT_ROOT, "opencode", "dist"),
    outDir: join(PROJECT_ROOT, "windowsterminal", "dist"),
  });
  for (const name of themes) console.log(`${name}: exported`);
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
