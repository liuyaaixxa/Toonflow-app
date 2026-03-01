import fs from "fs";
import path from "path";
import type { AddressInfo } from "net";

const dbPath = path.join(process.cwd(), "db.test.sqlite");
const portFile = path.join(process.cwd(), ".test-port");

let closeServe: (() => Promise<void>) | null = null;

export async function setup() {
  // Clean test database
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(portFile)) fs.unlinkSync(portFile);

  // Set env before importing app
  process.env.NODE_ENV = "dev";
  process.env.DB_FILE = "db.test.sqlite";
  process.env.OSSURL = "http://127.0.0.1:60000/";

  const app = await import("../src/app");

  // Override PORT after env.ts has loaded
  process.env.PORT = "0";

  const server = await app.default();

  // Wait for server to be ready
  await new Promise<void>((resolve) => {
    if (server.listening) return resolve();
    server.on("listening", resolve);
  });

  const addr = server.address() as AddressInfo;
  const port = addr.port;

  // Write port to file so test files can read it
  fs.writeFileSync(portFile, String(port));
  console.log(`[测试服务启动]: http://127.0.0.1:${port}`);

  closeServe = app.closeServe;
}

export async function teardown() {
  if (closeServe) await closeServe();

  // Close the knex/SQLite connection to prevent hanging
  try {
    const db = await import("../src/utils/db");
    await (db as any).db.destroy();
  } catch {}

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
}
