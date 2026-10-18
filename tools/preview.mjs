// Preview: render each theme as a terminal-styled HTML page, built from the
// *exported* tokens — so the images in the README come from the same values a
// consumer gets, not from a hand-drawn mock or a live TUI capture.
//
// Run `npm run export` first (it writes web/dist/tokens/tokens.json), then
// `node tools/preview.mjs` (or `npm run preview`). Output: web/dist/preview/.
// Capturing the images is a separate, manual step — see AGENTS.md.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TOKENS = join(PROJECT_ROOT, "web", "dist", "tokens");
const OUT = join(PROJECT_ROOT, "web", "dist", "preview");

/** One line of the story each theme tells, printed under its panel. */
const SUBTITLE = {
  fjord: "cold sea blue-grey",
  ravn: "ink black, violet sheen",
  nordlys: "night blue, aurora green",
  skumring: "grey-violet, quietest",
};

const span = (style, text) => `<span style="${style}">${text}</span>`;

// Token keys keep their dots in tokens.json (`text.base`); the CSS is what
// turns them into dashes. Ramps live in their own object, keyed by step.
const tok = (theme, path) => theme.tokens[path];
const step = (theme, hue, name) => theme.ramps[hue][name];

/**
 * A terminal panel for one theme in one mode.
 *
 * Every colour comes from that mode's exported tokens, so the preview cannot
 * drift from what a consumer receives.
 */
function panel(name, mode, t) {
  const terminal = [
    span(`color:${tok(t, "markdown.heading")}`, "## The four themes"),
    `This is body text on the ${mode} background.`,
    span(`color:${tok(t, "text.muted")}`, "A quieter line, for descriptions and hints."),
    `run ${span(`color:${tok(t, "markdown.code")}`, "npm test")} then read ${span(`color:${tok(t, "markdown.link")}`, "the design notes")}`,
    span(`color:${tok(t, "syntax.comment")}`, "// cold, in every sense"),
    `${span(`color:${tok(t, "syntax.keyword")}`, "const")} cold = ${span(`color:${tok(t, "syntax.string")}`, '"fjord"')}`,
    span(
      `display:block;background:${tok(t, "diff.background.added")};color:${tok(t, "diff.text.added")}`,
      "+ an added line in a diff",
    ),
    span(`display:block;background:${step(t, "gray", "800")}`, "the / cursor row"),
  ].join("\n");

  return `<section class="panel">
  <header style="color:${tok(t, "text.muted")};border-color:${tok(t, "border.base")}">
    <span class="dot" style="background:${step(t, "accent", "300")}"></span>
    ${name} <span class="thin">${mode}</span>
  </header>
  <pre style="background:${tok(t, "background.base")};color:${tok(t, "text.base")};border-color:${tok(t, "border.base")}">${terminal}</pre>
  <aside style="background:${tok(t, "background.raised.base")};color:${tok(t, "text.muted")};border-color:${tok(t, "border.base")}">
    a raised panel, for context blocks
  </aside>
  <footer>${tok(t, "background.base")} · ${tok(t, "text.base")} · ${SUBTITLE[name] ?? ""}</footer>
</section>`;
}

/** A page: any panels given, with the pack version in the corner. */
function page(title, panels, version) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px; background: #fff; font: 14px/1.5 -apple-system, system-ui, sans-serif; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.lede { margin: 0 0 24px; color: #555; }
  .row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 28px; }
  .panel { width: 400px; }
  .panel header { display: flex; align-items: center; gap: 8px; font: 12px/1 ui-monospace, Menlo, monospace; padding-bottom: 6px; border-bottom: 1px solid; margin-bottom: 8px; }
  .panel header .thin { opacity: .6; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  pre { margin: 0; padding: 14px; border: 1px solid; border-radius: 8px; font: 12px/1.7 ui-monospace, Menlo, monospace; white-space: pre-wrap; }
  aside { margin-top: 8px; padding: 10px 14px; border: 1px solid; border-radius: 8px; font: 12px/1.5 ui-monospace, Menlo, monospace; }
  footer { margin-top: 8px; color: #888; font: 11px/1.5 ui-monospace, Menlo, monospace; }
  .note { color: #888; font-size: 12px; }
</style></head>
<body>
<h1>${title}</h1>
<p class="lede">Rendered from the pack's exported tokens, v${version}.
<span class="note">Representative preview, not a screenshot of a running terminal.</span></p>
${panels.join("\n")}
</body></html>
`;
}

/**
 * Render every theme page and the hero index into `outDir`.
 *
 * A module rather than a bare script so test/export.test.mjs can render into a
 * temp dir and byte-compare the committed pages against it, the same guard the
 * other three targets get.
 *
 * @param {{tokensDir?: string, outDir?: string}} [paths]
 * @returns {string[]} the page filenames written, theme pages first
 */
export function render({ tokensDir = TOKENS, outDir = OUT } = {}) {
  const { version, themes } = JSON.parse(readFileSync(join(tokensDir, "tokens.json"), "utf8"));

  mkdirSync(outDir, { recursive: true });

  const names = Object.keys(themes);
  const written = [];

  for (const name of names) {
    const html = page(
      `rimfrost — ${name}`,
      ["dark", "light"].map((mode) => panel(name, mode, themes[name][mode])),
      version,
    );
    writeFileSync(join(outDir, `${name}.html`), html);
    written.push(`${name}.html`);
  }

  const hero = page(
    "rimfrost",
    names.flatMap((name) => ["dark", "light"].map((mode) => panel(name, mode, themes[name][mode]))),
    version,
  );
  writeFileSync(join(outDir, "index.html"), hero);
  written.push("index.html");

  return written;
}

function main() {
  const written = render();
  console.log(`wrote ${written.length} pages to ${OUT}: ${written.join(", ")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
