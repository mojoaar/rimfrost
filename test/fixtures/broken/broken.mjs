// A deliberately broken palette for `buildAll`: fjord's *dark* mode with its
// `neutral` hue deleted, so `buildTheme` throws before the validator ever runs.
// Light mode stays intact, which is what makes the thrown message name "dark".
import fjord from "../../../src/palettes/fjord.mjs";

const broken = structuredClone(fjord);
delete broken.modes.dark.hue.neutral;

export default broken;
