import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function isHostedDatabaseConfigured() {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function getDatabaseClient() {
  if (client) return client;

  const remoteUrl = process.env.TURSO_DATABASE_URL;
  if (remoteUrl) {
    if (!process.env.TURSO_AUTH_TOKEN) {
      throw new Error("TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set.");
    }
    client = createClient({
      url: remoteUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return client;
  }

  const databasePath = process.env.PERIOD_PLACE_DB_PATH || path.join(process.cwd(), ".data", "period-place.db");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  return client;
}
