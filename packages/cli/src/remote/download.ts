import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { runDuckDbCommand } from "../duckdb/runner.js";
import type { DuckDbProcessError } from "../duckdb/runner.js";
import type { FeedSource } from "./source.js";

export type RemoteFeedSource = Exclude<FeedSource, { kind: "local" }>;
type HttpFeedSource = Extract<FeedSource, { kind: "http" }>;
type ObjectFeedSource = Extract<FeedSource, { kind: "object" }>;

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const SECRET_PREFIX = "gtfs-viz-secret:";
const SECRET_READY = "gtfs-viz-credential-chain-ready";
const TEMPORARY_SECRET = "gtfs_viz_import_credential_chain";

const S3_HINT =
  "Check that the object exists and that DuckDB can read it: create a persistent secret (duckdb -c \"CREATE PERSISTENT SECRET (TYPE s3, KEY_ID '…', SECRET '…', REGION '…')\"), or provide AWS credentials through environment variables or an AWS profile or SSO login (used through credential_chain). For S3-compatible stores such as MinIO, add ENDPOINT, URL_STYLE 'path' and USE_SSL to the secret.";
const R2_HINT =
  "Create an R2 secret first: duckdb -c \"CREATE PERSISTENT SECRET (TYPE r2, KEY_ID '…', SECRET '…', ACCOUNT_ID '…')\".";

const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

// DuckDB's own error text, without the CLI's agent-mode hint line.
const duckDbMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error))
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^hint: -agent /.test(line))
    .join(" ")
    .trim();

// Every statement runs in a :memory: database; output is plain lines so stdout WARNINGs never break parsing.
const runSql = (sql: string) => runDuckDbCommand(["-bail", "-noheader", "-list", ":memory:", "-c", sql]);

const matchingSecrets = async (source: ObjectFeedSource) => {
  const { stdout } = await runSql(
    `SELECT ${sqlLiteral(SECRET_PREFIX)} || name FROM which_secret(${sqlLiteral(source.url)}, ${sqlLiteral(source.secretType)});`,
  );
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(SECRET_PREFIX))
    .map((line) => line.slice(SECRET_PREFIX.length));
};

// Secret lookup order: any matching DuckDB secret (persistent or not), then for s3 a temporary
// credential_chain secret in the same process, then an anonymous request. r2 needs a secret.
const downloadObject = async (source: ObjectFeedSource, file: string) => {
  const hint = source.secretType === "r2" ? R2_HINT : S3_HINT;
  const failed = (error: unknown, note = "") =>
    new Error(`Download failed for ${source.sourcePath}: ${duckDbMessage(error)}. ${note}${hint}`, { cause: error });
  const copy = `COPY (SELECT content FROM read_blob(${sqlLiteral(source.url)})) TO ${sqlLiteral(file)} (FORMAT blob);`;
  let secrets: string[];
  try {
    secrets = await matchingSecrets(source);
  } catch (error) {
    throw failed(error);
  }
  if (secrets.length > 0) {
    try {
      await runSql(copy);
    } catch (error) {
      throw failed(error);
    }
    return;
  }
  if (source.secretType === "r2") throw new Error(`No DuckDB secret matches ${source.sourcePath}. ${R2_HINT}`);
  try {
    await runSql(
      `CREATE TEMPORARY SECRET ${TEMPORARY_SECRET} (TYPE s3, PROVIDER credential_chain);\nSELECT ${sqlLiteral(SECRET_READY)};\n${copy}`,
    );
    return;
  } catch (error) {
    // The secret was created, so the COPY itself failed: report it rather than retrying anonymously.
    if ((error as DuckDbProcessError).stdout?.includes(SECRET_READY)) throw failed(error);
  }
  try {
    await runSql(copy);
  } catch (error) {
    throw failed(
      error,
      "No DuckDB secret matched and credential_chain found no AWS credentials, so the object was requested anonymously. ",
    );
  }
};

const downloadHttp = async (source: HttpFeedSource, file: string) => {
  let response: Response;
  try {
    response = await fetch(source.url, { redirect: "follow" });
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    const reason = cause instanceof Error ? cause.message : error instanceof Error ? error.message : String(error);
    throw new Error(`Download failed for ${source.sourcePath}: ${reason}`, { cause: error });
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    throw new Error(`Download failed for ${source.sourcePath}: ${status}`);
  }
  if (!response.body) throw new Error(`Download failed for ${source.sourcePath}: the response body is empty`);
  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
    createWriteStream(file, { flags: "wx" }),
  );
};

// Returns the size of a non-empty file that starts with the zip local-file signature.
const validateZip = async (source: RemoteFeedSource, file: string) => {
  const handle = await open(file, "r").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error(`Download failed for ${source.sourcePath}: nothing was downloaded`);
    throw error;
  });
  try {
    const { size } = await handle.stat();
    if (size === 0) throw new Error(`Download failed for ${source.sourcePath}: the downloaded file is empty`);
    const header = Buffer.alloc(ZIP_SIGNATURE.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < header.length || !header.equals(ZIP_SIGNATURE)) {
      throw new Error(`Downloaded file is not a zip archive: ${source.sourcePath}`);
    }
    return size;
  } finally {
    await handle.close();
  }
};

// Downloads a remote feed to <directory>/<random>.zip and validates it. The file is removed on
// failure; on success the caller owns it and must delete it after importing.
export const downloadFeed = async (source: RemoteFeedSource, directory: string) => {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${randomUUID()}.zip`);
  try {
    if (source.kind === "http") await downloadHttp(source, file);
    else await downloadObject(source, file);
    return { file, size: await validateZip(source, file) };
  } catch (error) {
    await rm(file, { force: true });
    throw error;
  }
};
