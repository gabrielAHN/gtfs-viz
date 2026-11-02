import path from "node:path";

// What `gtfs-viz import <source>` accepts. Remote sources download first, then import as a local zip.
export type FeedSource =
  | { kind: "local"; path: string; label: string }
  | { kind: "http"; url: string; sourcePath: string; fileName: string; label: string }
  | {
      kind: "object";
      secretType: "s3" | "r2";
      url: string;
      sourcePath: string;
      fileName: string;
      label: string;
    };

export const IMPORT_USAGE = "gtfs-viz import <feed.zip|https://…|s3://…|r2://…>";

export const SUPPORTED_SOURCES =
  "a local .zip path, an http:// or https:// URL, an s3://… object (also s3a:// and s3n://) or an r2://… object";

const DEFAULT_FILE_NAME = "feed.zip";

// Two or more characters, so a Windows drive such as C:\ or C:// stays a local path.
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]+):\/\//;

const objectSchemes: Record<string, "s3" | "r2"> = { s3: "s3", s3a: "s3", s3n: "s3", r2: "r2" };

// C0 and C1 control characters (tab, newline, escape, DEL, CSI, …): never part of a usable source,
// and printing them could rewrite the terminal.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

// Replaced with U+FFFD when a source is displayed: C0/C1 controls, and bidi or invisible formatting
// characters that could disguise it (zero-width and directional marks, embeddings, isolates, word
// joiner, BOM).
const UNSAFE_DISPLAY = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

// S3, R2 and MinIO bucket names never contain ":", "@", "%" or other punctuation, so anything else
// between scheme:// and the first "/" may be credentials (an AWS secret key often contains "/").
const BUCKET = /^[A-Za-z0-9._-]+$/;

const credentialsRefused = () =>
  new Error(
    "URLs with embedded credentials are not supported. Remove the user name and password from the URL: use a pre-signed URL for HTTP(S), or a DuckDB secret for s3:// and r2:// objects.",
  );

// What follows scheme://, split into the user info and the rest. The authority runs to the first "/"
// (or the end) and is deliberately not cut at "?" or "#", so a password containing them is still user
// info; an "@" after the first "/" belongs to the path. The user info ends at the authority's last "@".
const splitUserInfo = (rest: string): { userInfo?: string; rest: string } => {
  const slash = rest.indexOf("/");
  const at = (slash === -1 ? rest : rest.slice(0, slash)).lastIndexOf("@");
  return at === -1 ? { rest } : { userInfo: rest.slice(0, at), rest: rest.slice(at + 1) };
};

const isHttp = (scheme: string) => scheme === "http" || scheme === "https";

const parsesAsUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// A source split into its parts. It is opaque when only its scheme may be shown: an http(s) URL that
// does not parse once any user info is removed, or another scheme whose authority is not a valid
// bucket name. Either may hide credentials that are not recognisable as user info, such as a
// password containing "/".
const splitSource = (input: string) => {
  const match = SCHEME.exec(input);
  if (!match) return undefined;
  const scheme = match[1].toLowerCase();
  const raw = input.slice(match[0].length);
  const { userInfo, rest } = splitUserInfo(raw);
  const opaque = isHttp(scheme) ? !parsesAsUrl(`${scheme}://${rest}`) : !BUCKET.test(rest.split("/", 1)[0]);
  return { scheme, raw, userInfo, rest, opaque };
};

const opaqueLabel = (scheme: string) => `${scheme}://…`;

// The scheme plus everything before any query or fragment, without user info; only the scheme when
// the source is opaque.
export const sourceLabel = (input: string): string => {
  const source = splitSource(input);
  if (!source) return path.basename(input);
  if (source.opaque) return opaqueLabel(source.scheme);
  return `${source.scheme}://${source.rest.split(/[?#]/, 1)[0]}`.replace(UNSAFE_DISPLAY, "\ufffd");
};

// Shown instead of a long query value or a password found elsewhere in a message.
const PLACEHOLDER = "…";

// Removes the raw source, its query/fragment (also percent-encoded) and its user info from a message.
// Individual query values of 8+ characters (signatures, tokens) become a placeholder; shorter values
// such as format=zip are left alone so ordinary words in the message stay intact. For an opaque
// source, everything after scheme:// is hidden too, and so is everything before its last "@" (the
// likely user info), whole and piece by piece.
export const redactSource = (message: string, input: string): string => {
  const source = splitSource(input);
  if (!source) return message;
  // Messages may name the source with its scheme in lower case, as the parsed URL does. A bare
  // "scheme://" holds nothing to hide and would otherwise match the forms quoted in messages.
  const label = sourceLabel(input);
  let redacted = message;
  if (source.raw) redacted = redacted.split(input).join(label).split(`${source.scheme}://${source.raw}`).join(label);
  const { userInfo, rest } = source;
  const queryStart = rest.search(/[?#]/);
  const hidden: [string, string][] = [];
  // Values under 3 characters hold no secret, and hiding them would mangle punctuation such as ":".
  const hide = (value: string, replacement: string) => {
    if (value.length >= 3) hidden.push([value, replacement], [encodeURIComponent(value), replacement]);
  };
  if (queryStart !== -1) {
    const query = rest.slice(queryStart);
    hide(query, "");
    for (const part of query.slice(1).split(/[&#]/)) {
      const value = part.slice(part.indexOf("=") + 1);
      if (value.length >= 8) hide(value, PLACEHOLDER);
    }
  }
  const hideUserInfo = (info: string) => {
    hide(`${info}@`, "");
    hide(info, "");
    const password = info.slice(info.indexOf(":") + 1);
    hide(password, PLACEHOLDER);
  };
  if (userInfo) hideUserInfo(userInfo);
  if (source.opaque) {
    hide(source.raw, PLACEHOLDER);
    hide(source.raw.split(/[?#]/, 1)[0], PLACEHOLDER);
    const at = source.raw.lastIndexOf("@");
    if (at > 0) {
      const info = source.raw.slice(0, at);
      hideUserInfo(info);
      for (const piece of info.split(/[:/]/)) hide(piece, PLACEHOLDER);
    }
  }
  for (const [value, replacement] of hidden.sort((a, b) => b[0].length - a[0].length)) {
    if (value) redacted = redacted.split(value).join(replacement);
  }
  return redacted;
};

// Path separators, C0/C1 controls, and bidi or invisible formatting characters that could disguise
// the name when printed (zero-width and directional marks, embeddings, isolates, word joiner, BOM).
const UNSAFE_FILE_NAME = /[/\\\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;

// The decoded last path segment when it names a .zip file, else feed.zip.
const fileNameFrom = (pathname: string) => {
  const segment = pathname.split("/").pop() ?? "";
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {}
  if (!/\.zip$/i.test(decoded) || UNSAFE_FILE_NAME.test(decoded)) return DEFAULT_FILE_NAME;
  return decoded;
};

const parseHttp = (scheme: string, input: string, rest: string): FeedSource => {
  // Checked on the raw text before URL parsing, which would end the authority at "?" or "#".
  if (splitUserInfo(rest).userInfo !== undefined) throw credentialsRefused();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    // Nothing of the input is shown: it may hold credentials that are not recognisable as user
    // info, such as a password containing "/".
    throw new Error(
      `Invalid URL: ${opaqueLabel(scheme)} could not be parsed. Check the host and port; never put a user name or password in the URL (use a pre-signed URL instead).`,
    );
  }
  if (url.username || url.password) throw credentialsRefused();
  url.hash = "";
  const sourcePath = `${url.protocol}//${url.host}${url.pathname}`;
  return { kind: "http", url: url.href, sourcePath, fileName: fileNameFrom(url.pathname), label: sourcePath };
};

const parseObject = (scheme: string, secretType: "s3" | "r2", rest: string): FeedSource => {
  if (splitUserInfo(rest).userInfo !== undefined) throw credentialsRefused();
  const slash = rest.indexOf("/");
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  // Refused before any DuckDB call, without echoing the input: an invalid bucket such as
  // "<key id>:<secret part>" is how credentials whose password contains "/" end up here.
  if (authority && !BUCKET.test(authority)) {
    throw new Error(
      `Invalid bucket name in the ${scheme}:// source. Name one object as ${scheme}://<bucket>/<key>; put credentials in a DuckDB secret, never in the source.`,
    );
  }
  if (/[?#]/.test(rest)) {
    throw new Error(
      `${scheme}:// sources cannot carry a query string or fragment. Name the object as ${scheme}://<bucket>/<key> and configure credentials or endpoints with a DuckDB secret.`,
    );
  }
  const key = slash === -1 ? "" : rest.slice(slash + 1);
  if (!authority || !key) throw new Error(`Name one object as ${scheme}://<bucket>/<key>.`);
  if (/[*[]/.test(key)) throw new Error(`Wildcards are not supported: name one object as ${scheme}://<bucket>/<key>.`);
  const url = `${scheme}://${authority}/${key}`;
  return { kind: "object", secretType, url, sourcePath: url, fileName: fileNameFrom(key), label: url };
};

export const parseFeedSource = (input: string): FeedSource => {
  const match = SCHEME.exec(input);
  if (!match) return { kind: "local", path: input, label: path.basename(input) };
  const scheme = match[1].toLowerCase();
  const rest = input.slice(match[0].length);
  const secretType = objectSchemes[scheme];
  if ((isHttp(scheme) || secretType) && rest.search(CONTROL_CHARACTERS) !== -1) {
    throw new Error(
      `${scheme}:// sources cannot contain control characters such as tabs, newlines or escape sequences. Check how the source was quoted.`,
    );
  }
  if (isHttp(scheme)) return parseHttp(scheme, input, rest);
  if (secretType) return parseObject(scheme, secretType, rest);
  throw new Error(`Unsupported import source scheme "${scheme}://". Use ${SUPPORTED_SOURCES}.`);
};
