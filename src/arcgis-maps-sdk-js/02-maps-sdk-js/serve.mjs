// Serves this folder at http://localhost:3000 (no dependencies).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  const file = join(root, path || "index.html");
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
})
  .on("error", (error) => {
    if (error.code !== "EADDRINUSE") throw error;
    console.error(`Port ${port} is already in use. Stop the other app, or choose another port: PORT=3005 node serve.mjs`);
    process.exit(1);
  })
  .listen(port, "127.0.0.1", () => console.log(`App running at http://localhost:${port} — press Ctrl+C to stop.`));
