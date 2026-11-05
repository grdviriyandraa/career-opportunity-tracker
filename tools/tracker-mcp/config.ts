import { lstat, readFile, realpath, mkdir, open } from "node:fs/promises";
import path from "node:path";
export class BridgeError extends Error {
  constructor(
    public code: string,
    public retryable = false,
  ) {
    super(code);
  }
}
export type BridgeConfig = {
  origin: string;
  tokenFile: string;
  ledgerFile: string;
};
export function validateOrigin(value: string, allowLoopback = false) {
  try {
    const u = new URL(value);
    if (u.username || u.password || u.pathname !== "/" || u.search || u.hash)
      throw 0;
    const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(u.hostname);
    if (
      u.protocol !== "https:" &&
      !(u.protocol === "http:" && allowLoopback && loopback)
    )
      throw 0;
    return u.origin;
  } catch {
    throw new BridgeError("INVALID_CONFIGURATION");
  }
}
function contained(root: string, file: string) {
  const rel = path.relative(root, file);
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
}
export async function privatePath(
  value: string,
  repository: string,
  createParent = false,
) {
  if (!path.isAbsolute(value)) throw new BridgeError("INVALID_CONFIGURATION");
  if (createParent)
    await mkdir(path.dirname(value), { recursive: true, mode: 0o700 });
  const parent = await realpath(path.dirname(value));
  const file = path.join(parent, path.basename(value));
  if (contained(await realpath(repository), file))
    throw new BridgeError("PRIVATE_FILE_IN_REPOSITORY");
  try {
    const stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (process.platform !== "win32" && stat.mode & 0o077)
    )
      throw new BridgeError("PRIVATE_FILE_PERMISSIONS");
  } catch (e) {
    if (!(
      e instanceof Error &&
      "code" in e &&
      e.code === "ENOENT" &&
      createParent
    ))
      throw e;
  }
  return file;
}
export async function loadConfig(
  env: Record<string, string | undefined>,
  repository: string,
): Promise<BridgeConfig> {
  const origin = validateOrigin(
    env.TRACKER_ORIGIN ?? "",
    env.TRACKER_ALLOW_LOOPBACK_HTTP === "1",
  );
  const tokenFile = await privatePath(env.TRACKER_TOKEN_FILE ?? "", repository);
  const ledgerFile = await privatePath(
    env.TRACKER_LEDGER_FILE ?? "",
    repository,
    true,
  );
  if (tokenFile === ledgerFile) throw new BridgeError("INVALID_CONFIGURATION");
  return { origin, tokenFile, ledgerFile };
}
export async function readToken(file: string) {
  try {
    const stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > 1024 ||
      (process.platform !== "win32" && stat.mode & 0o077)
    )
      throw new BridgeError("CREDENTIAL_UNAVAILABLE");
    const token = (await readFile(file, "utf8")).trim();
    if (
      !/^[A-Za-z0-9_-]{43,512}$/.test(token) ||
      /^sb_(secret|publishable)_/.test(token)
    )
      throw new BridgeError("CREDENTIAL_UNAVAILABLE");
    return token;
  } catch {
    throw new BridgeError("CREDENTIAL_UNAVAILABLE");
  }
}

export async function prepareLedgerFile(file: string) {
  const handle = await open(file, "a", 0o600);
  await handle.close();
  const stat = await lstat(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (process.platform !== "win32" && stat.mode & 0o077)
  )
    throw new BridgeError("PRIVATE_FILE_PERMISSIONS");
}
