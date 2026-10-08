// Real-time alerting in the browser — ArcGIS Maps SDK for JavaScript 5.1

const [Point, containsOperator] = await Promise.all([
  $arcgis.import("@arcgis/core/geometry/Point.js"),
  $arcgis.import("@arcgis/core/geometry/operators/containsOperator.js"),
]);

// 1. The restricted area is tested against every observation, so prepare it once.
export function prepareArea(area) {
  containsOperator.accelerateGeometry(area);
}

// 2. Real-time analysis: test each observation the moment it arrives.
//    Alert only when a track crosses the boundary, not on every observation inside it.
export function watchArea(layerView, area, onAlert) {
  const wasInside = new Map(); // track ID → inside the area at its previous observation?

  return layerView.on("data-received", ({ attributes, geometry }) => {
    const point = new Point({ x: geometry.x, y: geometry.y, spatialReference: layerView.view.spatialReference });
    const inside = containsOperator.execute(area, point);
    const track = attributes.TRACKID;

    const before = wasInside.get(track); // undefined the first time we see this track
    if (before !== undefined && inside !== before) {
      onAlert(track, inside ? "entered" : "left");
    }
    wasInside.set(track, inside);
  });
}

// 3. How many observations arrive per second — drives the live chart.
export function watchRate(layerView, onRate) {
  return layerView.on("update-rate", ({ websocket }) => onRate(websocket));
}

// 4. Point-in-time analysis: summarise the latest observation of every track on the map.
export async function summarise(layerView, area) {
  const { features } = await layerView.queryLatestObservations();
  const typeField = Object.keys(features[0]?.attributes ?? {}).find((name) => name.endsWith("_TYPE"));

  const byType = {};
  for (const feature of features) {
    const type = feature.attributes[typeField];
    byType[type] = (byType[type] ?? 0) + 1;
  }
  const inArea = features.filter((feature) => containsOperator.execute(area, feature.geometry)).length;

  return { total: features.length, byType, inArea };
}
