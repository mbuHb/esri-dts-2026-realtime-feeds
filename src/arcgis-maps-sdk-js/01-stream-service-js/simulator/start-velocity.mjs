// Sends the vehicles to an ArcGIS Velocity HTTP Receiver feed as Esri JSON: one request per second,
// carrying every vehicle. The same file feeds the local fallback. Loops until you stop it.
// Usage: node simulator/start-velocity.mjs [HTTP Receiver URL]  — or set the URL in .env
import { receiverSettings, runSimulator } from "./run-simulator.mjs";

runSimulator("vehicles.ws.txt", {
  ...(await receiverSettings("vehicles")),
  httpFormat: "esri-json",
  linesPerInterval: 1,
  intervalMs: 1000,
  loop: true,
  exitOnComplete: false,
});
