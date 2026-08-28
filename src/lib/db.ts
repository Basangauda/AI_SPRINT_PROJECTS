import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb() {
  const { env } = getCloudflareContext();
  const db = env.DB;

  if (!db) {
    throw new Error("DB binding is not configured");
  }

  return db;
}
