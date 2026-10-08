// App shell: data sources, 2D/3D switch, restricted area, alerts panel and the code viewer.
// The alerting code itself lives in alerting.js.
import { prepareArea, summarise, watchArea, watchRate } from "./alerting.js";

const [StreamLayer, Basemap, VectorTileLayer, GraphicsLayer, SceneLayer, Graphic, Polygon, Point, reactiveUtils] = await Promise.all([
  $arcgis.import("@arcgis/core/layers/StreamLayer.js"),
  $arcgis.import("@arcgis/core/Basemap.js"),
  $arcgis.import("@arcgis/core/layers/VectorTileLayer.js"),
  $arcgis.import("@arcgis/core/layers/GraphicsLayer.js"),
  $arcgis.import("@arcgis/core/layers/SceneLayer.js"),
  $arcgis.import("@arcgis/core/Graphic.js"),
  $arcgis.import("@arcgis/core/geometry/Polygon.js"),
  $arcgis.import("@arcgis/core/geometry/Point.js"),
  $arcgis.import("@arcgis/core/core/reactiveUtils.js"),
]);

// Local simulator feeds — the fallback when no stream service is available.
const common = [
  { name: "OBJECTID", type: "oid" },
  { name: "TRACKID", type: "string" },
  { name: "SPEED_KMH", type: "double" },
  { name: "HEADING", type: "double" },
  { name: "STATUS", type: "string" },
  { name: "SIM_T", type: "integer" },
  { name: "SOURCE", type: "string" },
];
const LOCAL_FEEDS = {
  vehicles: { url: "ws://127.0.0.1:8080/vehicles", fields: [...common, { name: "VEHICLE_TYPE", type: "string" }] },
  drones: {
    url: "ws://127.0.0.1:8081/drones",
    fields: [...common, { name: "DRONE_TYPE", type: "string" }, { name: "ALT_M", type: "double" }],
  },
};

// The restricted area (self-drawn, SIMULATED), in Web Mercator like the basemap.
const AREA = new Polygon({
  rings: [[[966278.23, 6465483.66], [966791.86, 6465585.03], [966795.42, 6465340.28], [966260.3, 6465294.97], [966278.23, 6465483.66]]],
  spatialReference: { wkid: 102100 },
});
prepareArea(AREA);

// Symbols: flat in 2D, a 150 m translucent column in 3D (a no-fly volume for drones).
const RED = [176, 0, 32];
const areaSymbols = {
  "2d": {
    calm: { type: "simple-fill", color: [...RED, 0.12], outline: { color: RED, width: 2, style: "dash" } },
    alarm: { type: "simple-fill", color: [...RED, 0.45], outline: { color: RED, width: 3 } },
  },
  "3d": {
    calm: { type: "polygon-3d", symbolLayers: [{ type: "extrude", size: 150, material: { color: [...RED, 0.15] }, edges: { type: "solid", color: [...RED, 0.8] } }] },
    alarm: { type: "polygon-3d", symbolLayers: [{ type: "extrude", size: 150, material: { color: [...RED, 0.5] }, edges: { type: "solid", color: RED, size: 2 } }] },
  },
};

const speedColors = { type: "color", field: "SPEED_KMH", stops: [{ value: 0, color: "#8c8c8c" }, { value: 15, color: "#e8a200" }, { value: 30, color: "#1a7f37" }] };
// 2D: vehicles are arrows, drones are small airplanes — rotated by heading, coloured by speed.
const icon = (path, size) => ({
  type: "simple",
  symbol: { type: "simple-marker", style: "path", path, size, outline: { color: "white", width: 1 } },
  visualVariables: [{ type: "rotation", field: "HEADING", rotationType: "geographic" }, speedColors],
});
const arrows2D = icon("M0 -12 L7 9 L0 4 L-7 9 Z", 18);
const drones2D = icon("M0 -12 L2 -7 L2 -2 L11 3 L11 6 L2 3 L2 8 L5 10 L5 12 L0 11 L-5 12 L-5 10 L-2 8 L-2 3 L-11 6 L-11 3 L-2 -2 L-2 -7 Z", 22);

// 3D: Esri's realistic transportation models — one per vehicle type, a propeller airplane for drones.
const heading3D = { type: "rotation", field: "HEADING", axis: "heading", rotationType: "geographic" };
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
  visualVariables: [heading3D, { type: "size", valueExpression: "25", valueUnit: "meters", axis: "depth" }],
};
const drones3D = {
  type: "simple",
  symbol: model("Airplane_Propeller"),
  visualVariables: [heading3D, { type: "size", valueExpression: "30", valueUnit: "meters", axis: "width" }], // 30 m wingspan
};

const $ = (selector) => document.querySelector(selector);
const state = { dimension: "2d" };
let view, areaGraphic, rates = [];

// ---- View: an arcgis-map (2D) or arcgis-scene (3D), rebuilt on every switch ----------------

function createView() {
  view?.remove();
  const is3D = state.dimension === "3d";
  view = document.createElement(is3D ? "arcgis-scene" : "arcgis-map");
  view.basemap = new Basemap({
    baseLayers: [new VectorTileLayer({ url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer" })],
  });
  if (is3D) {
    view.ground = "world-elevation";
    view.cameraPosition = "8.6830, 50.1005, 900";
    view.cameraTilt = 60;
    view.cameraHeading = 0;
    view.environment = { lighting: { directShadowsEnabled: true } };
  } else {
    view.center = "8.6835, 50.1102";
    view.zoom = 15;
  }
  $("#viewContainer").append(view);

  // The restricted area and its label, on the ground (2D) or as a column (3D).
  areaGraphic = new Graphic({ geometry: AREA, symbol: areaSymbols[state.dimension].calm });
  const label = new Graphic({
    geometry: new Point({ x: 966530, y: 6465600, z: is3D ? 170 : 0, spatialReference: { wkid: 102100 } }),
    symbol: { type: "text", text: "Restricted area (SIMULATED)", color: RED, haloColor: "white", haloSize: 1.5, font: { size: 11, weight: "bold" } },
  });
  const thisView = view; // the user may switch 2D/3D again before this view is ready
  thisView
    .viewOnReady()
    .then(() => {
      // 3D city: Esri 3D Buildings (Living Atlas), under the restricted area and the live data.
      if (is3D) thisView.map?.add(new SceneLayer({ portalItem: { id: "b8fec5af7dfe4866b1b8ac2d2800f282" }, popupEnabled: false }));
      thisView.map?.add(new GraphicsLayer({ graphics: [areaGraphic, label], elevationInfo: { mode: "relative-to-ground" } }));
    })
    .catch(() => {});
}

// ---- Sources: any number of stream layers at once, each watched for the restricted area -------

const sources = []; // { url, fields, label, layer, layerView, handles, status, rate }

function addSource(definition, label) {
  if (sources.some((source) => source.url === definition.url)) return; // already on the map
  const source = { ...definition, label, handles: [], status: "connecting", rate: 0 };
  sources.push(source);
  $("#summary").innerHTML = ""; // a summary is only valid for the sources it was made from
  renderSources();
  attach(source);
}

function removeSource(source) {
  detach(source);
  sources.splice(sources.indexOf(source), 1);
  $("#summary").innerHTML = "";
  renderSources();
}

// Creates the source's layer in the current view and starts watching it.
async function attach(source) {
  const thisView = view; // the view may be replaced (2D/3D switch) while this runs
  const { url, fields } = source;
  const options = { title: `${source.label} (SIMULATED)`, purgeOptions: { displayCount: 1000, maxObservations: 1 }, renderer: arrows2D };
  const layer = url.startsWith("ws")
    ? new StreamLayer({ webSocketUrl: url, fields, geometryType: "point", objectIdField: "OBJECTID", timeInfo: { trackIdField: "TRACKID" }, ...options })
    : new StreamLayer({ url, ...options });
  source.layer = layer;

  await thisView.viewOnReady();
  await layer.load().catch(() => {});
  if (source.layer !== layer || view !== thisView) return layer.destroy(); // replaced meanwhile
  layer.popupTemplate = layer.createPopupTemplate();
  const isDrones = layer.fields.some((f) => f.name === "ALT_M");
  if (state.dimension === "3d") {
    layer.renderer = isDrones ? drones3D : vehicles3D;
    if (isDrones) layer.elevationInfo = { mode: "relative-to-ground", featureExpressionInfo: { expression: "$feature.ALT_M" } };
  } else if (isDrones) {
    layer.renderer = drones2D;
  }
  thisView.map.add(layer);
  const layerView = await thisView.whenLayerView(layer);
  if (source.layer !== layer) return;
  source.layerView = layerView;
  source.handles.push(
    watchArea(layerView, AREA, raiseAlert),
    watchRate(layerView, (perSecond) => (source.rate = perSecond)),
    reactiveUtils.watch(() => layerView.connectionStatus, (status) => ((source.status = status), renderSources()), { initial: true }),
  );
}

function detach(source) {
  source.handles.forEach((handle) => handle.remove());
  source.handles = [];
  if (source.layer) view.map?.remove(source.layer);
  source.layer?.destroy();
  source.layer = source.layerView = null;
  source.rate = 0;
}

function renderSources() {
  const list = $("#sources");
  list.innerHTML = sources.length ? "" : '<li class="empty">None yet — add one above</li>';
  for (const source of sources) {
    const item = document.createElement("li");
    item.innerHTML = `<span><strong></strong><small></small></span><button title="Remove" aria-label="Remove">✕</button>`;
    item.querySelector("strong").textContent = source.label;
    item.querySelector("small").textContent = source.status;
    item.querySelector("button").addEventListener("click", () => removeSource(source));
    list.append(item);
  }
}

// ---- Alerts, chart and summary ------------------------------------------------------------------

function raiseAlert(track, change) {
  $("#alerts .empty")?.remove();
  const item = document.createElement("li");
  item.className = change === "entered" ? "enter" : "exit";
  item.innerHTML = `<time>${new Date().toLocaleTimeString()}</time><strong>${track}</strong> ${change} the restricted area`;
  $("#alerts").prepend(item);
  if (change === "entered") {
    areaGraphic.symbol = areaSymbols[state.dimension].alarm;
    setTimeout(() => (areaGraphic.symbol = areaSymbols[state.dimension].calm), 3000);
  }
}

// Observations per second across all sources, drawn once a second.
setInterval(() => {
  const perSecond = sources.reduce((sum, source) => sum + source.rate, 0);
  $("#rate").textContent = perSecond;
  rates.push(perSecond);
  if (rates.length > 60) rates.shift();
  const max = Math.max(10, ...rates);
  $("#spark").setAttribute("points", rates.map((v, i) => `${i + 60 - rates.length},${20 - (v / max) * 18}`).join(" "));
}, 1000);

$("#summarise").addEventListener("click", async () => {
  const views = sources.map((source) => source.layerView).filter(Boolean);
  const results = await Promise.all(views.map((layerView) => summarise(layerView, AREA)));
  let total = 0, inArea = 0;
  const byType = {};
  for (const result of results) {
    total += result.total;
    inArea += result.inArea;
    for (const [type, n] of Object.entries(result.byType)) byType[type] = (byType[type] ?? 0) + n;
  }
  const rows = [["On the map", total], ...Object.entries(byType).map(([type, n]) => [`— ${type}`, n]), ["In the restricted area", inArea]];
  $("#summary").innerHTML = `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>`;
});

// ---- Adding sources -----------------------------------------------------------------------------

function remember(url) {
  try { localStorage.setItem("d3.streamServiceUrl", url); } catch {}
}
function recall() {
  try { return localStorage.getItem("d3.streamServiceUrl") ?? ""; } catch { return ""; }
}

function serviceName(url) {
  const match = url.match(/services\/([^/]+)\/StreamServer/i);
  return match ? decodeURIComponent(match[1]).replace(/_/g, " ") : "Stream service";
}

$("#connect").addEventListener("click", () => {
  const url = $("#serviceUrl").value.trim();
  if (!url) return $("#serviceUrl").focus();
  remember(url);
  addSource({ url }, serviceName(url));
});
$("#useLocal").addEventListener("click", () => {
  const name = $("#localFeed").value;
  addSource(LOCAL_FEEDS[name], `Local ${name}`);
});

document.querySelectorAll("[data-dimension]").forEach((button) =>
  button.addEventListener("click", () => {
    sources.forEach(detach);
    state.dimension = button.dataset.dimension;
    document.querySelectorAll("[data-dimension]").forEach((b) => b.setAttribute("aria-pressed", b === button));
    createView();
    sources.forEach(attach);
  }),
);

// ---- Code viewer: shows alerting.js exactly as it runs ----------------------------------------

$("#showCode").addEventListener("click", async () => {
  const code = $("#code");
  code.textContent = await (await fetch("alerting.js")).text();
  delete code.dataset.highlighted;
  hljs.highlightElement(code); // highlight.js, loaded in index.html
  $("#codeDialog").showModal();
});

// ---- Start ------------------------------------------------------------------------------------

createView();
renderSources();
// ?url=… (repeatable) adds stream services on load.
const fromQuery = new URLSearchParams(location.search).getAll("url");
fromQuery.forEach((url) => addSource({ url }, serviceName(url)));
$("#serviceUrl").value = fromQuery[0] ?? recall();
