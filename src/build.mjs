// Build: turn every palette spec in a directory into the theme file that
// `opencode/dist/<name>.json` (and, with `--install`, `~/.config/opencode/themes/`) holds.
//
// The palette *filename* is the theme name. Each palette is built and validated
// independently: a broken one is reported and skipped, never written, and never
// stops the others — the build collects errors instead of throwing, and only
// exits non-zero once every palette has had its turn.

import { readdirSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildTheme } from "./theme.mjs";
import { validateTheme } from "./validate.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

// `buildAll` is synchronous (callers destructure its result without awaiting),
// so the palette specs are loaded with require(esm) rather than dynamic import.
const require = createRequire(import.meta.url);

/**
 * Build and validate every `.mjs` palette in `palettesDir`, writing the ones
 * that pass to `<outDir>/<name>.json`.
 *
 * @param {object} options
 * @param {string} options.palettesDir directory of palette specs
 * @param {string} options.outDir directory for `<name>.json`
 * @param {boolean} [options.install] also copy each written file into
 *   `~/.config/opencode/themes/`
 * @returns {{built: string[], errors: string[]}} `built` is the theme names
 *   written, `errors` is one `"<name>: <message>"` entry per problem
 */
export function buildAll({ palettesDir, outDir, install = false }) {
  const built = [];
  const errors = [];
  mkdirSync(outDir, { recursive: true });

  const names = readdirSync(palettesDir)
    .filter((file) => file.endsWith(".mjs"))
    .map((file) => file.slice(0, -".mjs".length))
    .sort();

  for (const name of names) {
    let theme;
    try {
      // `resolve` (cwd) keeps this in step with the `readdirSync` above; a bare
      // `require` would resolve against this file, not the caller's cwd.
      const spec = require(resolve(palettesDir, `${name}.mjs`)).default;
      theme = buildTheme(spec);
    } catch (error) {
      // buildTheme throws on a malformed spec (a missing hue), before the
      // validator can say anything useful. Record the message and move on.
      errors.push(`${name}: ${error.message}`);
      continue;
    }

    const { ok, errors: findings } = validateTheme(theme);
    if (!ok) {
      for (const finding of findings) errors.push(`${name}: ${finding}`);
      continue;
    }

    writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(theme, null, 2)}\n`);
    built.push(name);
  }

  if (install) {
    const installDir = join(homedir(), ".config", "opencode", "themes");
    mkdirSync(installDir, { recursive: true });
    for (const name of built) {
      copyFileSync(join(outDir, `${name}.json`), join(installDir, `${name}.json`));
    }
  }

  return { built, errors };
}

/** One greppable summary line per theme, e.g. `fjord: ok` / `broken: 1 error`. */
function summarize(built, errors) {
  const counts = new Map(built.map((name) => [name, 0]));
  for (const entry of errors) {
    const name = entry.slice(0, entry.indexOf(":"));
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) =>
    `${name}: ${count === 0 ? "ok" : `${count} error${count === 1 ? "" : "s"}`}`);
}

/**
 * CLI entry: build the real palettes into the opencode target's folder (or
 * `--out <dir>`), install if `--install`, and exit 1 when any palette failed.
 * Summary goes to stdout, errors to stderr.
 */
function main() {
  // `--out` exists so the tests can drive this CLI without rewriting the
  // committed output: a run that regenerates a stale file just before the
  // fresh-build guard reads it would hide the staleness.
  const at = process.argv.indexOf("--out");
  const { built, errors } = buildAll({
    palettesDir: join(PROJECT_ROOT, "src", "palettes"),
    outDir: at === -1 ? join(PROJECT_ROOT, "opencode", "dist") : process.argv[at + 1],
    install: process.argv.includes("--install"),
  });

  for (const line of summarize(built, errors)) console.log(line);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

// Only run when invoked as a script; the tests import `buildAll` directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
