import fs from "fs";
import path from "path";

const portFile = path.join(process.cwd(), ".test-port");

/** Get the base URL of the running test server */
export function getBaseUrl(): string {
  const port = fs.readFileSync(portFile, "utf-8").trim();
  return `http://127.0.0.1:${port}`;
}
