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

const credentialsRefused = () =>
  new Error(
    "URLs with embedded credentials are not supported. Remove the user name and password from the URL: use a pre-signed URL for HTTP(S), or a DuckDB secret for s3:// and r2:// objects.",
  );

// The scheme plus everything before any query or fragment, without user info.
export const sourceLabel = (input: string): string => {
  const match = SCHEME.exec(input);
  if (!match) return path.basename(input);
  let rest = input.slice(match[0].length).split(/[?#]/, 1)[0];
  const at = rest.lastIndexOf("@");
  if (at !== -1) rest = rest.slice(at + 1);
  return `${match[1].toLowerCase()}://${rest}`;
};

// Removes the raw source, its query/fragment (also percent-encoded) and its user info from a message.
export const redactSource = (message: string, input: string): string => {
  const match = SCHEME.exec(input);
  if (!match) return message;
  let redacted = message.split(input).join(sourceLabel(input));
  const rest = input.slice(match[0].length);
  const queryStart = rest.search(/[?#]/);
  const hidden: string[] = [];
  if (queryStart !== -1) {
    const query = rest.slice(queryStart);
    hidden.push(query, encodeURIComponent(query));
    for (const part of query.slice(1).split(/[&#]/)) {
      const value = part.slice(part.indexOf("=") + 1);
      if (value.length >= 3) hidden.push(value, encodeURIComponent(value));
    }
  }
  const authority = queryStart === -1 ? rest : rest.slice(0, queryStart);
  const at = authority.lastIndexOf("@");
  if (at !== -1) hidden.push(authority.slice(0, at + 1), authority.slice(0, at));
  for (const value of hidden.sort((a, b) => b.length - a.length)) {
    if (value) redacted = redacted.split(value).join("");
  }
  return redacted;
};

// The decoded last path segment when it names a .zip file, else feed.zip.
const fileNameFrom = (pathname: string) => {
  const segment = pathname.split("/").pop() ?? "";
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {}
  if (!/\.zip$/i.test(decoded) || /[/\\\u0000-\u001f\u007f]/.test(decoded)) return DEFAULT_FILE_NAME;
  return decoded;
};

const parseHttp = (input: string): FeedSource => {
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
  const slash = rest.indexOf("/");
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  if (authority.includes("@")) throw credentialsRefused();
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
  if (scheme === "http" || scheme === "https") return parseHttp(input);
  const secretType = objectSchemes[scheme];
  if (secretType) return parseObject(scheme, secretType, input.slice(match[0].length));
  throw new Error(`Unsupported import source scheme "${scheme}://". Use ${SUPPORTED_SOURCES}.`);
};
