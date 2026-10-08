// Fallback feed: vehicles at ws://127.0.0.1:8080/vehicles, one update per second.
// The replay starts when the app connects and loops until you stop it.
import { runSimulator } from "./run-simulator.mjs";

runSimulator("vehicles.ws.txt", {
  protocol: "ws",
  mode: "server",
  ip: "127.0.0.1",
  port: 8080,
  wsPath: "/vehicles",
  wsTls: false,
  wsFormat: "json",
  waitForClient: true,
  connectTimeoutMs: 0,
  linesPerInterval: 1,
  intervalMs: 1000,
  loop: true,
});
