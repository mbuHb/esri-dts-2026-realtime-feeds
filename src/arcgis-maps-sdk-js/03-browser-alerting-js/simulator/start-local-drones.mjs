// Fallback feed: drones at ws://127.0.0.1:8081/drones, one update per second.
// DR-07 enters the restricted area 40 seconds after the app connects.
// The replay starts when the app connects and loops until you stop it.
import { runSimulator } from "./run-simulator.mjs";

runSimulator("drones.ws.txt", {
  protocol: "ws",
  mode: "server",
  ip: "127.0.0.1",
  port: 8081,
  wsPath: "/drones",
  wsTls: false,
  wsFormat: "json",
  waitForClient: true,
  connectTimeoutMs: 0,
  linesPerInterval: 1,
  intervalMs: 1000,
  loop: true,
});
