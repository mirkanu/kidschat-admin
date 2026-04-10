#!/usr/bin/env tsx
/**
 * deploy-librechat-yaml.ts
 *
 * Deploys .planning/phases/02-safety-configuration/librechat.yaml to the
 * GitHub Gist backing LibreChat's CONFIG_PATH, then pins the new revision
 * and triggers a LibreChat redeploy on Railway.
 *
 * Usage:
 *   npx tsx scripts/deploy-librechat-yaml.ts
 *
 * Required environment variables (from Railway or .env.local):
 *   GITHUB_GIST_TOKEN    — Fine-grained PAT with gist scope
 *   GIST_ID              — GitHub Gist ID
 *   RAILWAY_API_TOKEN    — Railway bearer token
 *   RAILWAY_PROJECT_ID   — Railway project ID
 *   RAILWAY_SERVICE_LIBRECHAT_ID  — LibreChat service ID
 *   RAILWAY_SERVICE_ID   — Admin service ID (for updating GITHUB_GIST_TOKEN)
 *   RAILWAY_ENVIRONMENT_ID        — Production environment ID
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = join(__dirname, "../.planning/phases/02-safety-configuration/librechat.yaml");
const GIST_FILENAME = "librechat.yaml";
const RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2";
const GITHUB_API = "https://api.github.com";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

async function updateGist(
  gistId: string,
  token: string,
  content: string
): Promise<string> {
  const payload = {
    files: {
      [GIST_FILENAME]: { content },
    },
  };

  const res = await fetch(`${GITHUB_API}/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub Gist PATCH failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { history: Array<{ version: string }> };
  const version = data.history?.[0]?.version;
  if (!version) throw new Error("Gist update succeeded but no version hash returned");
  return version;
}

async function railwayMutation(token: string, query: string): Promise<void> {
  const res = await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Railway API error (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { errors?: Array<{ message: string }> };
  if (data.errors?.length) {
    throw new Error(`Railway GraphQL error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
}

async function main(): Promise<void> {
  // Load env (try .env.local for local runs, otherwise use process.env from Railway)
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: join(__dirname, "../.env.local") });
  } catch {
    // dotenv optional — not needed in Railway
  }

  const gistToken = requireEnv("GITHUB_GIST_TOKEN");
  const gistId = requireEnv("GIST_ID");
  const railwayToken = requireEnv("RAILWAY_API_TOKEN");
  const projectId = requireEnv("RAILWAY_PROJECT_ID");
  const libreServiceId = requireEnv("RAILWAY_SERVICE_LIBRECHAT_ID");
  const adminServiceId = requireEnv("RAILWAY_SERVICE_ID");
  const envId = requireEnv("RAILWAY_ENVIRONMENT_ID");

  console.log("Reading YAML from:", YAML_PATH);
  const yamlContent = readFileSync(YAML_PATH, "utf-8");

  console.log("Patching Gist", gistId, "...");
  const version = await updateGist(gistId, gistToken, yamlContent);
  console.log("Gist version:", version);

  const newConfigPath = `https://gist.githubusercontent.com/mirkanu/${gistId}/raw/${version}/${GIST_FILENAME}`;
  console.log("New CONFIG_PATH:", newConfigPath);

  // Pin CONFIG_PATH on LibreChat service
  console.log("Updating CONFIG_PATH on LibreChat service...");
  await railwayMutation(
    railwayToken,
    `mutation { variableUpsert(input: { projectId: "${projectId}", serviceId: "${libreServiceId}", environmentId: "${envId}", name: "CONFIG_PATH", value: "${newConfigPath}" }) }`
  );

  // Trigger redeploy
  console.log("Triggering LibreChat redeploy...");
  await railwayMutation(
    railwayToken,
    `mutation { serviceInstanceRedeploy(serviceId: "${libreServiceId}", environmentId: "${envId}") }`
  );

  console.log("Deploy complete!");
  console.log("  Gist version:", version);
  console.log("  CONFIG_PATH:", newConfigPath);
  console.log("");
  console.log("Verify balance is active after LibreChat restarts:");
  console.log("  curl https://librechat-production-bff2.up.railway.app/api/balance -H 'Authorization: Bearer <jwt>'");
  console.log("  Expected: a balance number (not 'endpoint disabled')");
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
