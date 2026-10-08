// StreamLayer essentials — ArcGIS Maps SDK for JavaScript 5.1

const StreamLayer = await $arcgis.import("@arcgis/core/layers/StreamLayer.js");

// 1. Connect to a stream service, for example one published by ArcGIS Velocity.
//    The service describes its own fields, geometry and track ID.
export function createStreamLayer(url, display, tracks) {
  return new StreamLayer({ url, ...options(display, tracks) });
}

// 1b. Fallback: connect straight to a WebSocket.
//     There is no service description, so we declare the schema ourselves.
export function createWebSocketLayer(webSocketUrl, fields, display, tracks) {
  return new StreamLayer({
    webSocketUrl,
    fields,
    geometryType: "point",
    objectIdField: "OBJECTID",
    timeInfo: { trackIdField: "TRACKID" }, // observations with the same ID form one track
    ...options(display, tracks),
  });
}

// 2. Purge: how much of the stream the browser keeps.
const purge = {
  latest: { displayCount: 1000, maxObservations: 1 },  // latest position of each track
  all: { displayCount: 100000, maxObservations: 100000 }, // keep everything (watch it grow)
};

// 3. 2D renderers: a symbol rotated by heading and coloured by speed.
//    Vehicles are arrows, drones are small airplanes.
const speedColors = { type: "color", field: "SPEED_KMH", stops: [{ value: 0, color: "#8c8c8c" }, { value: 15, color: "#e8a200" }, { value: 30, color: "#1a7f37" }] };
const icon = (path, size) => ({
  type: "simple",
  symbol: { type: "simple-marker", style: "path", path, size, outline: { color: "white", width: 1 } },
  visualVariables: [{ type: "rotation", field: "HEADING", rotationType: "geographic" }, speedColors],
});
const renderer = icon("M0 -12 L7 9 L0 4 L-7 9 Z", 18); // vehicles: an arrow
const drones2D = icon("M0 -12 L2 -7 L2 -2 L11 3 L11 6 L2 3 L2 8 L5 10 L5 12 L0 11 L-5 12 L-5 10 L-2 8 L-2 3 L-11 6 L-11 3 L-2 -2 L-2 -7 Z", 22);

// 4. Tracks (beta): a line behind each track through its last 20 positions. Drawn in 2D only.
const trackInfo = {
  enabled: true,
  maxDisplayObservationsPerTrack: 20,
  latestObservations: { renderer },       // the current position
  previousObservations: { visible: false }, // earlier positions: only the line, not the symbols
  trackLines: { renderer: { type: "simple", symbol: { type: "simple-line", width: 2, color: [0, 121, 193, 0.8] } } },
};

function options(display, tracks) {
  // Purge options cannot change after the layer loads, so each combination is a new layer.
  const purgeOptions = { ...purge[display] };
  if (tracks) purgeOptions.maxObservations = Math.max(purgeOptions.maxObservations, 20); // keep history for the line
  return { title: "Live feed (SIMULATED)", purgeOptions, renderer, trackInfo: tracks ? trackInfo : null };
}

// 5. 3D: real 3D models, turned to face their heading.
const heading3D = { type: "rotation", field: "HEADING", axis: "heading", rotationType: "geographic" };
const bigger = { type: "size", valueExpression: "25", valueUnit: "meters", axis: "depth" }; // 5× life size, readable from afar

// Vehicles: Esri's realistic transportation models, one per vehicle type.
const model = (name) => ({ type: "web-style", styleName: "EsriRealisticTransportationStyle", name });
const vehicles3D = {
  type: "unique-value",
  field: "VEHICLE_TYPE",
  uniqueValueInfos: [
    { value: "bus", symbol: model("Bus") },
    { value: "van", symbol: model("Ford_Transit_Commercial_Van") },
    { value: "truck", symbol: model("Delivery_Truck") },
    { value: "service", symbol: model("Pickup_Truck_Toyota_Hilux") },
  ],
  visualVariables: [heading3D, bigger],
};

// Drones: Esri's small propeller airplane, flying at its altitude.
const drones3D = {
  type: "simple",
  symbol: model("Airplane_Propeller"),
  visualVariables: [heading3D, { type: "size", valueExpression: "30", valueUnit: "meters", axis: "width" }], // 30 m wingspan
};

// Pick the symbols once the layer has loaded: drones are the data with an ALT_M field.
export async function useSymbols(layer, is3D) {
  await layer.load();
  const isDrones = layer.fields.some((field) => field.name === "ALT_M");
  if (is3D) layer.renderer = isDrones ? drones3D : vehicles3D;
  else layer.renderer = isDrones ? drones2D : renderer;
  if (layer.trackInfo) layer.trackInfo.latestObservations.renderer = layer.renderer;
  if (is3D && isDrones) {
    // Place each drone ALT_M metres above the ground.
    layer.elevationInfo = { mode: "relative-to-ground", featureExpressionInfo: { expression: "$feature.ALT_M" } };
  }
}

// 6. React to every observation as it arrives.
export function onObservation(layerView, callback) {
  return layerView.on("data-received", callback);
}

// 7. Filter. A stream service filters on the server, so less data reaches the browser.
//    A plain WebSocket cannot, so the layer view filters in the browser instead.
export function setFilter(layer, layerView, where, extent) {
  if (layer.url) {
    layer.definitionExpression = where;
    layer.geometryDefinition = extent;
  } else {
    layerView.filter = where || extent ? { where, geometry: extent } : null;
  }
}
