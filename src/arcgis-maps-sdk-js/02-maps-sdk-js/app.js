// App shell: data source, 2D/3D switch, counters and the code viewer.
// The StreamLayer code itself lives in streamlayer.js.
import { createStreamLayer, createWebSocketLayer, onObservation, setFilter, useSymbols } from "./streamlayer.js";

const [Basemap, VectorTileLayer, SceneLayer, Extent, reactiveUtils] = await Promise.all([
  $arcgis.import("@arcgis/core/Basemap.js"),
  $arcgis.import("@arcgis/core/layers/VectorTileLayer.js"),
  $arcgis.import("@arcgis/core/layers/SceneLayer.js"),
  $arcgis.import("@arcgis/core/geometry/Extent.js"),
  $arcgis.import("@arcgis/core/core/reactiveUtils.js"),
]);

const ESRI_3D_BUILDINGS = "b8fec5af7dfe4866b1b8ac2d2800f282"; // Esri 3D Buildings scene layer, Living Atlas

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

const OLD_TOWN = new Extent({ xmin: 965363, ymin: 6464653, xmax: 967589, ymax: 6466389, spatialReference: { wkid: 102100 } });
const FILTERS = {
  all: [null, null],
  moving: ["SPEED_KMH > 0", null],
  oldtown: [null, OLD_TOWN],
};

const $ = (selector) => document.querySelector(selector);
const state = { source: null, dimension: "2d", display: "latest", tracks: false, filter: "all" };
let view, layer, layerView, handles = [], received = 0;

// ---- View: an arcgis-map (2D) or arcgis-scene (3D), rebuilt on every switch ----------------

function createView() {
  view?.remove();
  view = document.createElement(state.dimension === "3d" ? "arcgis-scene" : "arcgis-map");
  view.basemap = new Basemap({
    baseLayers: [new VectorTileLayer({ url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer" })],
  });
  if (state.dimension === "3d") {
    view.ground = "world-elevation";
    view.cameraPosition = "8.6845, 50.0925, 900";
    view.cameraTilt = 68;
    view.cameraHeading = 0;
    view.environment = { lighting: { directShadowsEnabled: true } }; // shadows show how high each drone is
  } else {
    view.center = "8.6845, 50.1095";
    view.zoom = 14;
  }
  $("#viewContainer").append(view);

  // 3D city: Esri 3D Buildings (Living Atlas), under the live data.
  if (state.dimension === "3d") {
    const thisView = view; // the user may switch again before this view is ready
    thisView.viewOnReady().then(() => thisView.map?.add(new SceneLayer({ portalItem: { id: ESRI_3D_BUILDINGS }, popupEnabled: false }), 0)).catch(() => {});
  }
}

// ---- Layer: rebuilt whenever the source, the display mode or the dimension changes ---------

async function showLayer() {
  handles.forEach((handle) => handle.remove());
  handles = [];
  if (layer) view.map?.remove(layer);
  layer = layerView = null;
  if (!state.source) return;

  const { source, display } = state;
  const tracks = state.tracks && state.dimension === "2d"; // track display (beta) draws in 2D only
  layer = source.url.startsWith("ws")
    ? createWebSocketLayer(source.url, source.fields, display, tracks)
    : createStreamLayer(source.url, display, tracks);
  layer.when(() => (layer.popupTemplate = layer.createPopupTemplate()), () => {});

  await view.viewOnReady();
  await useSymbols(layer, state.dimension === "3d").catch(() => {});
  view.map.add(layer);
  layerView = await view.whenLayerView(layer);
  applyFilter(state.filter);

  handles.push(
    onObservation(layerView, () => ($("#received").textContent = (++received).toLocaleString())),
    reactiveUtils.watch(() => layerView.connectionStatus, (status) => ($("#status").textContent = status), { initial: true }),
  );
}

function applyFilter(name) {
  state.filter = name;
  document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.filter === name));
  if (layer && layerView) setFilter(layer, layerView, ...FILTERS[name]);
}

setInterval(async () => {
  const count = layerView ? await layerView.queryFeatureCount().catch(() => 0) : 0;
  $("#drawn").textContent = count.toLocaleString();
}, 1000);

// ---- Data source ----------------------------------------------------------------------------

function remember(url) {
  try { localStorage.setItem("d2.streamServiceUrl", url); } catch {}
}
function recall() {
  try { return localStorage.getItem("d2.streamServiceUrl") ?? ""; } catch { return ""; }
}

function useSource(source, label) {
  state.source = source;
  received = 0;
  $("#received").textContent = "0";
  $("#sourceLabel").textContent = label;
  showLayer();
}

$("#connect").addEventListener("click", () => {
  const url = $("#serviceUrl").value.trim();
  if (!url) return $("#serviceUrl").focus();
  remember(url);
  useSource({ url }, "Stream service");
});
$("#useLocal").addEventListener("click", () => {
  const name = $("#localFeed").value;
  useSource(LOCAL_FEEDS[name], `Local simulator (${name})`);
});

// ---- Display controls -------------------------------------------------------------------------

document.querySelectorAll("[data-dimension]").forEach((button) =>
  button.addEventListener("click", () => {
    state.dimension = button.dataset.dimension;
    document.querySelectorAll("[data-dimension]").forEach((b) => b.setAttribute("aria-pressed", b === button));
    $("#tracks").disabled = state.dimension === "3d";
    $("#tracksNote").hidden = state.dimension !== "3d";
    createView();
    showLayer();
  }),
);
$("#display").addEventListener("change", (event) => {
  state.display = event.target.value;
  showLayer();
});
$("#tracks").addEventListener("change", (event) => {
  state.tracks = event.target.checked;
  showLayer();
});
document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));

// ---- Code viewer: shows streamlayer.js exactly as it runs -------------------------------------

$("#showCode").addEventListener("click", async () => {
  const source = await (await fetch("streamlayer.js")).text();
  const code = $("#code");
  code.textContent = source;
  delete code.dataset.highlighted;
  hljs.highlightElement(code); // highlight.js, loaded in index.html
  $("#codeDialog").showModal();
});

// ---- Start ------------------------------------------------------------------------------------

createView();
const fromQuery = new URLSearchParams(location.search).get("url");
$("#serviceUrl").value = fromQuery ?? recall();
if (fromQuery) $("#connect").click();
