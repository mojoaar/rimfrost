// Alacritty check: the sixteen-colour palette a terminal loads, as TOML.
//
// Unlike the Ghostty test there is no hand-made file outside the repo to pin
// against, so this asserts the mapping itself: every slot is the ramp step the
// design names, and the shape a wrong serialiser would break.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { exportAlacritty } from "../src/export-alacritty.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
// The exporter maps the theme JSON OpenCode ships, so build a fresh set of it
// here and hand it over — the same input the CLI gets from `opencode/dist/`.
const themesDir = mkdtempSync(join(tmpdir(), "rimfrost-themes-"));
const outDir = mkdtempSync(join(tmpdir(), "rimfrost-alacritty-"));
buildAll({ palettesDir: PALETTES, outDir: themesDir });
const { themes, errors } = exportAlacritty({ themesDir, outDir });
const body = (file) => readFileSync(join(outDir, file), "utf8");
const mode = (file) => (file.endsWith("-light.toml") ? "light" : "dark");
const themefile = (file) =>
  JSON.parse(readFileSync(join(themesDir, `${file.replace(/(-light)?\.toml$/, "")}.json`), "utf8"));
/** Every TOML value line, as [table, key, "#rrggbb"], in file order. */
const entries = (file) => {
  let table = "";
  return body(file).split("\n").flatMap((line) => {
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      table = section[1];
      return [];
    }
    const pair = line.match(/^([a-z]+) = "(#[0-9a-f]{6})"$/);
    return pair ? [[table, pair[1], pair[2]]] : [];
  });
};
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
// Alacritty names the ANSI roles; the pack's purple is Alacritty's magenta.
const NORMAL = [["gray", "900"], ...CHROMATIC.map((hue) => [hue, "300"]), ["gray", "300"]];
const BRIGHT = [["gray", "600"], ...CHROMATIC.map((hue) => [hue, "200"]), ["gray", "100"]];

test("every theme is exported as two mode files, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
  assert.deepEqual(
    readdirSync(outDir).sort(),
    themes.flatMap((name) => [`${name}-light.toml`, `${name}.toml`]),
  );
});

test("every slot is the ramp step the design names", () => {
  for (const file of readdirSync(outDir)) {
    const { hue, background, text } = themefile(file)[mode(file)];
    // A hue entry is either a ramp or a whole-hue alias; follow the alias.
    const ramp = (name) =>
      typeof hue[name] === "string" ? hue[hue[name].replace("$hue.", "")] : hue[name];
    const expected = Object.fromEntries([
      ...ANSI.map((name, i) => [`normal ${name}`, ramp(NORMAL[i][0])[NORMAL[i][1]]]),
      ...ANSI.map((name, i) => [`bright ${name}`, ramp(BRIGHT[i][0])[BRIGHT[i][1]]]),
      ["primary background", background.base],
      ["primary foreground", text.base],
      ["cursor text", background.base],
      ["cursor cursor", ramp("accent")["300"]],
      ["selection text", text.base],
      ["selection background", background.raised.high],
    ]);
    // deepEqual on the whole map: a missing key and a stray key both fail.
    assert.deepEqual(
      Object.fromEntries(entries(file).map(([table, key, value]) => [`${table.replace("colors.", "")} ${key}`, value])),
      expected,
      `${file} does not match the mapping`,
    );
  }
});

test("the five tables are present, in order, with 22 values", () => {
  for (const file of readdirSync(outDir)) {
    assert.deepEqual(
      body(file).split("\n").filter((line) => line.startsWith("[")),
      ["[colors.primary]", "[colors.cursor]", "[colors.selection]", "[colors.normal]", "[colors.bright]"],
      file,
    );
    assert.equal(entries(file).length, 22, file);
  }
});

test("no orange reaches a terminal: there is no ANSI slot for it", () => {
  // Deliberate and documented — pinned so it cannot drift back in.
  for (const file of readdirSync(outDir)) {
    for (const step of Object.values(themefile(file)[mode(file)].hue.orange)) {
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
  for (const file of readdirSync(outDir)) {
    const { hue } = themefile(file)[mode(file)];
    const [normal, bright] = [hue.red["300"], hue.red["200"]];
    if (mode(file) === "dark") assert.ok(lum(bright) > lum(normal), `${file}: bright should be lighter`);
    else assert.ok(lum(bright) < lum(normal), `${file}: bright should be darker`);
  }
});
