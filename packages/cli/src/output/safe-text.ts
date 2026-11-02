// Text that did not come from the CLI itself (a server's reason phrase, a stored source, a local path,
// a DuckDB message) reaches the terminal only through safeTerminalText, so it cannot move the cursor,
// retitle or recolour the terminal, or disguise itself with bidi or invisible characters.

// Bidi and invisible formatting characters that can disguise text: the Arabic letter mark,
// zero-width and directional marks, embeddings and overrides, the word joiner and invisible
// operators, isolates, and the BOM. A regular-expression character-class fragment.
export const FORMATTING_CHARACTERS = "\\u061c\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2069\\ufeff";

// Whole escape sequences: CSI (ESC [ or C1 CSI) with its parameters and final byte; OSC, DCS, SOS,
// PM and APC strings (ESC ] P X ^ _ or their C1 forms) up to BEL or ST; any other ESC sequence.
const ESCAPE_SEQUENCES = new RegExp(
  [
    "(?:\\u001b\\[|\\u009b)[0-?]*[ -/]*[@-~]",
    "(?:\\u001b[\\]PX^_]|[\\u0090\\u0098\\u009d\\u009e\\u009f])[^\\u0007\\u001b\\u009c]*(?:\\u0007|\\u001b\\\\|\\u009c)?",
    "\\u001b[ -/]*[0-~]",
  ].join("|"),
  "g",
);

// C0 controls except tab and newline, DEL, C1 controls, and formatting characters.
const UNSAFE_CHARACTERS = new RegExp(`[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f${FORMATTING_CHARACTERS}]`, "g");

// Strips escape sequences, then replaces any other control or formatting character with U+FFFD.
export const safeTerminalText = (text: string) =>
  text.replace(ESCAPE_SEQUENCES, "").replace(UNSAFE_CHARACTERS, "\ufffd");
