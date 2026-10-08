// Sends the drones to an ArcGIS Velocity HTTP Receiver feed as Esri JSON: one request per second,
// carrying every drone. The same file feeds the local fallback. Loops until you stop it.
// DR-07 enters the restricted area 40 s after start. Restart this script to replay the alert.
// Usage: node simulator/start-velocity-drones.mjs [HTTP Receiver URL]  — or set the URL in .env
import { receiverSettings, runSimulator } from "./run-simulator.mjs";

runSimulator("drones.ws.txt", {
  ...(await receiverSettings("drones")),
  httpFormat: "esri-json",
  linesPerInterval: 1,
  intervalMs: 1000,
  loop: true,
  exitOnComplete: false,
});
