// Local feed at ws://127.0.0.1:8080/vehicles — four times faster, for rehearsing.
// VH-07 enters the restricted area 10 seconds after the app connects.
import { runSimulator } from "./run-simulator.mjs";

runSimulator("vehicles.ws.txt", {
  protocol: "ws",
  mode: "server",
  ip: "127.0.0.1",
  port: 8080,
  wsPath: "/vehicles",
  wsTls: false,
  wsFormat: "json",
  waitForClient: true, // the replay starts when the app connects
  connectTimeoutMs: 0,
  linesPerInterval: 1,
  intervalMs: 250,
  loop: true, // the data is seamless: vehicles keep circling until you stop the feed
});
