// Ghostty check: the sixteen-colour palettes a terminal loads.
//
// The fixtures are the eight files the author had installed before this
// exporter existed, so they pin the mapping slot by slot. The mapping is right:
// if the generator and a fixture ever disagree, the generator is wrong, because
// the fixtures are what Ghostty already renders correctly.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { exportGhostty } from "../src/export-ghostty.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
const FIXTURES = join(PROJECT_ROOT, "test", "fixtures", "ghostty");
// The exporter maps the theme JSON OpenCode ships, so build a fresh set of it here
// and hand it over — the same input the CLI gets from `opencode/dist/`.
const themesDir = mkdtempSync(join(tmpdir(), "rimfrost-themes-"));
const outDir = mkdtempSync(join(tmpdir(), "rimfrost-ghostty-"));
buildAll({ palettesDir: PALETTES, outDir: themesDir });
const { themes, errors } = exportGhostty({ themesDir, outDir });
const body = (file) => readFileSync(join(outDir, file), "utf8");
const themefile = (file) =>
  JSON.parse(readFileSync(join(themesDir, `${file.replace(" Light", "").toLowerCase()}.json`), "utf8"));
const mode = (file) => (file.endsWith(" Light") ? "light" : "dark");

test("every theme is exported as two mode files, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
  assert.deepEqual(readdirSync(outDir).sort(), [
    "Fjord", "Fjord Light", "Nordlys", "Nordlys Light",
    "Ravn", "Ravn Light", "Skumring", "Skumring Light",
  ]);
});

test("the output is byte-identical to the eight installed reference files", () => {
  for (const file of readdirSync(FIXTURES)) {
    assert.equal(body(file), readFileSync(join(FIXTURES, file), "utf8"), `ghostty/${file} differs`);
  }
});

test("every file is 22 lines: sixteen palette slots then six keys", () => {
  for (const file of readdirSync(FIXTURES)) {
    const lines = body(file).trimEnd().split("\n");
    assert.equal(lines.length, 22, `${file} has ${lines.length} lines`);
    for (let slot = 0; slot < 16; slot++) {
      assert.match(lines[slot], new RegExp(`^palette = ${slot}=#[0-9a-f]{6}$`), `${file} line ${slot}`);
    }
    for (const key of ["background", "foreground", "cursor-color", "cursor-text", "selection-background", "selection-foreground"]) {
      assert.match(body(file), new RegExp(`^${key} = #[0-9a-f]{6}$`, "m"), `${file} is missing ${key}`);
    }
  }
});

test("no orange reaches a terminal: there is no ANSI slot for it", () => {
  // Deliberate and documented in the README — pinned so it cannot drift back in.
  for (const file of readdirSync(FIXTURES)) {
    const theme = themefile(file);
    for (const step of Object.values(theme[mode(file)].hue.orange)) {
      assert.ok(!body(file).includes(step), `${file} carries orange ${step}`);
    }
  }
});

test("bright slots in light mode are darker, not lighter", () => {
  // A light ramp runs dark (100) to light (900), so the bright pair runs the
  // opposite hex direction to dark mode. Comparing luminance pins the rule.
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const file of readdirSync(FIXTURES)) {
    const { hue } = themefile(file)[mode(file)];
    const [normal, bright] = [hue.red["300"], hue.red["200"]];
    if (mode(file) === "dark") assert.ok(lum(bright) > lum(normal), `${file}: bright should be lighter`);
    else assert.ok(lum(bright) < lum(normal), `${file}: bright should be darker`);
  }
});
