// Starts ArcGIS Velocity Simulator in CLI (headless) mode with the given settings.
// Used by the start-*.mjs scripts next to this file.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function isSimulator(dir) {
  const pkg = join(dir, "package.json");
  if (!existsSync(pkg)) return false;
  try {
    return JSON.parse(readFileSync(pkg, "utf8")).name === "arcgis-velocity-simulator";
  } catch {
    return false;
  }
}

function findSimulator() {
  // SIMULATOR_DIR may be relative: it is resolved against the demo folder, where .env lives.
  // Otherwise look next to the repository: <parent>/arcgis-velocity-simulator.
  const candidates = [
    process.env.SIMULATOR_DIR && resolve(here, "..", process.env.SIMULATOR_DIR),
    resolve(here, "../../../../../arcgis-velocity-simulator"),
    resolve(here, "../../../../../arcgis-velocity-simulator/arcgis-velocity-simulator"),
  ].filter(Boolean);
  const found = candidates.find(isSimulator);
  if (!found) {
    console.error("ArcGIS Velocity Simulator not found. Looked in:\n  " + candidates.join("\n  "));
    console.error("Set SIMULATOR_DIR to the folder that contains the simulator's package.json.");
    process.exit(1);
  }
  if (!existsSync(join(found, "node_modules", "electron"))) {
    console.error(`Simulator dependencies are not installed. Run "npm install" in:\n  ${found}`);
    process.exit(1);
  }
  return found;
}

/**
 * Reads KEY=value lines from the demo's .env file (git-ignored) into process.env.
 * Variables already set in the shell win.
 */
function loadEnvFile() {
  const file = resolve(here, "..", ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined && value !== "") process.env[key] = value;
  }
}

/**
 * Turns an ArcGIS Velocity HTTP Receiver URL into simulator connection settings.
 *
 * `dataset` names the .env keys: VEHICLES_RECEIVER_URL, VEHICLES_USERNAME, VEHICLES_PASSWORD
 * (or DRONES_…). A URL on the command line wins over the .env file.
 *
 * The simulator's command line cannot send credentials, so when a username is set a small
 * relay on this machine adds them: simulator → http://127.0.0.1:<port> → receiver.
 */
export async function receiverSettings(dataset, url = process.argv[2]) {
  loadEnvFile();
  const prefix = dataset.toUpperCase();
  url ||= process.env[`${prefix}_RECEIVER_URL`];
  if (!url) {
    console.error(`No receiver URL. Set ${prefix}_RECEIVER_URL in .env (see .env.sample), or pass it:`);
    console.error("  node <script> <ArcGIS Velocity HTTP Receiver URL>");
    process.exit(1);
  }
  const target = new URL(url);
  const { [`${prefix}_USERNAME`]: username, [`${prefix}_PASSWORD`]: password } = process.env;
  const common = { protocol: "http", mode: "client", httpPath: target.pathname + target.search, connectWaitForServer: true, connectTimeoutMs: 0 };

  if (!username) {
    const tls = target.protocol === "https:";
    return { ...common, ip: target.hostname, port: target.port || (tls ? 443 : 80), httpTls: tls };
  }
  const port = await startAuthRelay(target, `Basic ${Buffer.from(`${username}:${password ?? ""}`).toString("base64")}`);
  console.log(`Sending to ${target.origin} with basic authentication as "${username}".`);
  return { ...common, ip: "127.0.0.1", port, httpTls: false };
}

/** Forwards every request to the receiver, adding the Authorization header. */
async function startAuthRelay(target, authorization) {
  const [http, https] = await Promise.all([import("node:http"), import("node:https")]);
  const client = target.protocol === "https:" ? https : http;
  let warned = false;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const upstream = client.request(
        new URL(req.url, target.origin),
        { method: req.method, headers: { "Content-Type": req.headers["content-type"] ?? "application/json", "Content-Length": body.length, Authorization: authorization } },
        (answer) => {
          if (answer.statusCode === 401 && !warned) {
            warned = true;
            console.error("The receiver rejected the credentials (HTTP 401). Check VELOCITY_USERNAME and VELOCITY_PASSWORD.");
          }
          res.writeHead(answer.statusCode, answer.headers);
          answer.pipe(res);
        },
      );
      upstream.on("error", (error) => res.writeHead(502).end(error.message));
      upstream.end(body);
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return server.address().port;
}

/** Runs the simulator. `file` is relative to the data folder. */
export function runSimulator(file, settings) {
  const simulatorDir = findSimulator();
  const args = {
    runMode: "headless",
    explain: false,
    autoConnect: true,
    autoStart: true,
    exitOnComplete: true,
    onError: "continue",
    ...settings,
    filename: join(here, "data", file),
  };
  const argv = [
    join(simulatorDir, "scripts", "start-helper.js"),
    ...Object.entries(args).map(([k, v]) => `${k}=${v}`),
  ];
  console.log(`Replaying ${file} — press Ctrl+C to stop.`);
  // Some terminals (for example inside editors built on Electron) set ELECTRON_RUN_AS_NODE,
  // which would start the simulator as plain Node.js instead of Electron.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, argv, { cwd: simulatorDir, stdio: "inherit", env });
  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
}
