// Read-only diagnostics. No API keys, cookies or bearer tokens are sent.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { devNull } from "node:os";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
let projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!projectUrl) {
  try {
    const file = await readFile(new URL(".env.local", root), "utf8");
    // Read only the public URL. Never load or print other configuration values.
    const match = file.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*?)\s*$/m);
    projectUrl = match?.[1]?.replace(/^(["'])(.*)\1$/, "$2");
  } catch {
    // A new checkout may intentionally have no local configuration.
  }
}
const targets = [
  { name: "MCP", url: "https://mcp.supabase.com/mcp" },
  { name: "Management API", url: "https://api.supabase.com/v1/projects" },
  { name: "Docs", url: "https://supabase.com/changelog.md" },
];
try {
  const parsed = new URL(projectUrl);
  if (
    parsed.protocol !== "https:" ||
    !/^[a-z0-9]{20}\.supabase\.co$/.test(parsed.hostname) ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error("Invalid public project URL");
  targets.unshift({
    name: "Project Auth",
    url: parsed.origin + "/auth/v1/health",
  });
} catch {
  console.log(
    "Project Auth: SKIPPED — set a valid public NEXT_PUBLIC_SUPABASE_URL in environment settings or ignored .env.local.",
  );
}
let policy;
try {
  const snapshot = JSON.parse(
    await readFile("/etc/codex/network-policy.json", "utf8"),
  );
  policy = snapshot.http_network_policy;
} catch {
  // Outside the managed cloud, the platform policy snapshot is unavailable.
}
if (policy) {
  console.log(
    "Startup policy snapshot: " +
      policy.type +
      ". Use environment_status for current enforcement and configuration revision.",
  );
  if (policy.type === "restricted") {
    const hosts = new Set((policy.egress_rules ?? []).map((r) => r.host));
    const matched = targets.filter((t) =>
      hosts.has(new URL(t.url).hostname),
    ).length;
    console.log(
      `Exact target hosts listed in startup snapshot: ${matched}/${targets.length} (wildcards not evaluated).`,
    );
  }
}
console.log(
  "Checking HTTPS via inherited proxy/TLS settings; no credentials sent.",
);
function check(target) {
  return new Promise((resolve) => {
    let stdout = "",
      stderr = "",
      completed = false;
    const child = spawn(
      "curl",
      [
        "--disable",
        "--silent",
        "--show-error",
        "--output",
        devNull,
        "--connect-timeout",
        "6",
        "--max-time",
        "12",
        "--write-out",
        "%{http_code}",
        target.url,
      ],
      {
        cwd: fileURLToPath(root),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        // Preserve proxy and CA configuration. No shell and no redirects.
      },
    );
    const finish = (result) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve({ name: target.name, ...result });
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, status: "TIMEOUT" });
    }, 15_000);
    child.stdout.on("data", (data) => {
      stdout = (stdout + data).slice(-64);
    });
    child.stderr.on("data", (data) => {
      stderr = (stderr + data).slice(-4096);
    });
    child.on("error", () => finish({ ok: false, status: "CURL_UNAVAILABLE" }));
    child.on("close", (code) => {
      const status = Number(stdout.trim());
      if (/CONNECT tunnel failed, response 403/i.test(stderr))
        finish({ ok: false, status: "PROXY_CONNECT_403" });
      else if (code === 60) finish({ ok: false, status: "TLS_TRUST_ERROR" });
      else if (code === 28) finish({ ok: false, status: "TIMEOUT" });
      else if (code === 0 && status === 403)
        finish({ ok: false, status: "HTTP_403_UNCLASSIFIED" });
      else if (code === 0 && status >= 100 && status <= 599)
        finish({ ok: true, status: "HTTP_" + status });
      else finish({ ok: false, status: "TRANSPORT_ERROR" });
    });
  });
}
const results = await Promise.all(targets.map(check));
for (const result of results) console.log(`${result.name}: ${result.status}`);
console.log(
  "HTTP status alone does not prove service health or authentication; 401 commonly means authorization is still required. An ordinary HTTP 403 is inconclusive and needs further diagnosis.",
);
process.exitCode = results.some((r) => !r.ok)
  ? 1
  : targets.length === 4
    ? 0
    : 2;
