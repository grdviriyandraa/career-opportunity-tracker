import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, readToken, prepareLedgerFile } from "./config.js";
import { IntentLedger } from "./ledger.js";
import { TrackerClient } from "./client.js";
import { createBridge } from "./server.js";
try {
  const repository = fileURLToPath(new URL("../../..", import.meta.url));
  const config = await loadConfig(process.env, repository);
  await readToken(config.tokenFile);
  await prepareLedgerFile(config.ledgerFile);
  const ledger = new IntentLedger(config.ledgerFile);
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      ledger.close();
    }
  };
  const client = new TrackerClient(config, ledger);
  const server = createBridge(client);
  const transport = new StdioServerTransport(process.stdin, process.stdout, {
    maxBufferSize: 131072,
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    client.close();
    try {
      await server.close();
    } finally {
      release();
    }
  };
  const safeClose = () => {
    void close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", safeClose);
  process.once("SIGTERM", safeClose);
  transport.onclose = () => {
    client.close();
    release();
  };
  process.stdin.once("end", safeClose);
  await server.connect(transport);
} catch {
  process.stderr.write(
    "Tracker MCP startup failed. Check trusted configuration and private credential/ledger files.\n",
  );
  process.exitCode = 1;
}
