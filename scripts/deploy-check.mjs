// Read configuration from the invoking process; report only field/cause codes.
import { deploymentPreflight } from "../lib/deploy-preflight.ts";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--config-only") || args.length > 1) {
  console.error("Usage: npm run deploy:check -- [--config-only]");
  process.exitCode = 2;
} else {
  const result = await deploymentPreflight(
    process.env,
    fetch,
    args.includes("--config-only"),
  );
  if (process.versions.node.split(".")[0] !== "24")
    result.issues.push("NODE_24_REQUIRED");
  if (result.issues.length) result.automated_checks = "blocked";
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.issues.length ? 1 : 0;
}
