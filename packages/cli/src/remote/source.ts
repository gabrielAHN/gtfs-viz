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

// The scheme plus everything before any query or fragment, without user info.
export const sourceLabel = (input: string): string => {
  const match = SCHEME.exec(input);
  if (!match) return path.basename(input);
  const { rest } = splitUserInfo(input.slice(match[0].length));
  return `${match[1].toLowerCase()}://${rest.split(/[?#]/, 1)[0]}`.replace(CONTROL_CHARACTERS, "\ufffd");
};

// Shown instead of a long query value or a password found elsewhere in a message.
const PLACEHOLDER = "…";

// Removes the raw source, its query/fragment (also percent-encoded) and its user info from a message.
// Individual query values of 8+ characters (signatures, tokens) become a placeholder; shorter values
// such as format=zip are left alone so ordinary words in the message stay intact.
export const redactSource = (message: string, input: string): string => {
  const match = SCHEME.exec(input);
  if (!match) return message;
  let redacted = message.split(input).join(sourceLabel(input));
  const { userInfo, rest } = splitUserInfo(input.slice(match[0].length));
  const queryStart = rest.search(/[?#]/);
  const hidden: [string, string][] = [];
  const hide = (value: string, replacement: string) => {
    hidden.push([value, replacement], [encodeURIComponent(value), replacement]);
  };
  if (queryStart !== -1) {
    const query = rest.slice(queryStart);
    hide(query, "");
    for (const part of query.slice(1).split(/[&#]/)) {
      const value = part.slice(part.indexOf("=") + 1);
      if (value.length >= 8) hide(value, PLACEHOLDER);
    }
  }
  if (userInfo) {
    hide(`${userInfo}@`, "");
    hide(userInfo, "");
    const password = userInfo.slice(userInfo.indexOf(":") + 1);
    if (password.length >= 3) hide(password, PLACEHOLDER);
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

const parseHttp = (input: string, rest: string): FeedSource => {
  // Checked on the raw text before URL parsing, which would end the authority at "?" or "#".
  if (splitUserInfo(rest).userInfo !== undefined) throw credentialsRefused();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${sourceLabel(input)}`);
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
  if ((scheme === "http" || scheme === "https" || secretType) && rest.search(CONTROL_CHARACTERS) !== -1) {
    throw new Error(
      `${scheme}:// sources cannot contain control characters such as tabs, newlines or escape sequences. Check how the source was quoted.`,
    );
  }
  if (scheme === "http" || scheme === "https") return parseHttp(input, rest);
  if (secretType) return parseObject(scheme, secretType, rest);
  throw new Error(`Unsupported import source scheme "${scheme}://". Use ${SUPPORTED_SOURCES}.`);
};
