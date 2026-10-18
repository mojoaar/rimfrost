# Changelog

All notable changes to this pack. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version follows
[SemVer](https://semver.org) read as a design-token API: a colour retune is a **patch**, because
consumers bind to token names rather than to exact hex.

## [Unreleased]

### Added

- **Terminal.app**, **Windows Terminal** and **foot** as three more targets. `npm run export` now
  writes `terminal/dist/*.terminal`, `windowsterminal/dist/*.json` and `foot/dist/*.ini` alongside
  the rest, so the same colours reach eight target folders.
- Neither Terminal.app nor Windows Terminal has a selection-foreground slot, so each picks that
  colour itself. foot needs 1.26 or newer: its `[colors-dark]`/`[colors-light]` sections replaced
  `[colors]`/`[colors2]`, which were removed in 1.28.

## [1.1.0] — 2026-10-18

### Added

- **Alacritty** and **iTerm2** as terminal targets: `alacritty/dist/*.toml` and
  `iterm/dist/*.json`, from the same sixteen ANSI slots as the Ghostty palettes. Alacritty
  imports one file; iTerm2 picks a dynamic profile up from its own folder. Terminals have no
  orange slot, so orange does not reach either of them.

## [1.0.0] — 2026-10-18

First release, under its own name and in its own repository.

### Added

- **Rimfrost**, the pack name: the frost that forms on a clear, still night.
- **fjord** — cold sea blue-grey with a teal accent; the flagship.
- **ravn** — ink black with a violet sheen; the darkest.
- **nordlys** — night blue with aurora green; the most saturated.
- **skumring** — grey-violet, barely any colour; the quietest.
- A light mode for every theme: **overcast**, a cool tinted sky rather than a white page, tinted
  per theme so the four stay recognisably different days.
- Eleven nine-step ramps per theme (`gray`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`,
  `purple`, plus the `accent`, `interactive` and `neutral` aliases), with the four steps between
  each pair of anchors interpolated in OKLab so a ramp keeps its hue.
- **Three targets.** `npm run export` writes OpenCode theme JSON to `opencode/dist/`,
  sixteen-colour Ghostty palettes to `ghostty/dist/` — one file per theme per mode — and the same
  colours as CSS custom properties and JSON to `web/dist/tokens/`. Terminals have no orange slot,
  so orange is the one colour that does not reach Ghostty.
