# 02 · StreamLayer with the ArcGIS Maps SDK for JavaScript

A single-page app that shows what a `StreamLayer` can do: connect to a stream service, purge old
observations, draw tracks, filter, react to every observation, and switch between 2D and 3D.
**Show code** displays the StreamLayer code the app runs.

Two **simulated** datasets are included, replayed by
[ArcGIS Velocity Simulator](https://github.com/Esri/arcgis-velocity-simulator):

- **Vehicles** — eight made-up vehicles driving the streets of central Frankfurt.
- **Drones** — eight made-up drones flying over Frankfurt, with an altitude (`ALT_M`) for 3D.

## Requirements

- ArcGIS Velocity (ArcGIS Online or ArcGIS Enterprise)
- [Node.js](https://nodejs.org/) 20 or later
- [Git](https://git-scm.com/)
- An internet connection (the app loads the SDK and the basemap from Esri's CDN)

## Launch

1. **Get ArcGIS Velocity Simulator.** Clone it next to this repository and install it:

   ```sh
   git clone https://github.com/Esri/arcgis-velocity-simulator.git
   cd arcgis-velocity-simulator
   npm install
   cd ..
   ```

   Your folders should now look like this:

   ```
   arcgis-velocity-simulator/
   esri-dts-2026-realtime-feeds/
   ```

   Keep the simulator somewhere else? Set the `SIMULATOR_DIR` environment variable to its folder.

2. **Create a feed in ArcGIS Velocity** for each dataset you want to use:
   - Type: **HTTP Receiver**, data format **Esri JSON**
   - Sample data: paste one line from `simulator/data/vehicles.ws.txt` or
     `simulator/data/drones.ws.txt`
   - Geometry: from the data (Web Mercator)
   - Track ID: `TRACKID`
   - Authentication: **None** or **Basic**

   Copy each feed's **receiver URL** from its details page.

   Then copy `.env.sample` to `.env` in this folder and fill in `VEHICLES_RECEIVER_URL` and
   `DRONES_RECEIVER_URL`. If a feed uses basic authentication, also fill in its `…_USERNAME` and
   `…_PASSWORD`. `.env` is git-ignored, so your credentials stay out of commits.

3. **Publish the stream layers.** For each feed, create a real-time analytic with the feed as its
   source and a **stream layer** output — for example `Vehicles (SIMULATED)` and
   `Drones (SIMULATED)`. Start the analytics.

4. **Send the data.** From this folder (`02-maps-sdk-js`), one terminal per dataset:

   ```sh
   node simulator/start-velocity-vehicles.mjs
   node simulator/start-velocity-drones.mjs
   ```

   Each sends every vehicle's or drone's position once a second and loops until you press
   <kbd>Ctrl</kbd>+<kbd>C</kbd>.

5. **Start the app.** In another terminal, from the same folder:

   ```sh
   node serve.mjs
   ```

6. **Open** <http://localhost:3000>, paste a stream layer's service URL (ending in
   `/StreamServer`) into **Stream service URL** and click **Connect**. The app remembers the last
   URL.

7. **Try it:**
   - **2D / 3D** — in 3D, vehicles become 3D models and drones fly at their altitude; their
     shadows show how high they are.
   - **Display** — *Latest position only* keeps one observation per track; *Keep everything*
     shows what happens without purging (watch *On the map* climb).
   - **Show tracks (beta)** — a line behind each track through its last 20 positions. 2D only.
   - **Filter** — show only what is moving, or only what is inside the old town. On a stream
     service the filter runs on the server.
   - **Show code** — the StreamLayer code behind all of the above.

## Fallback: without ArcGIS Velocity

The app can also connect straight to the simulator on your machine, with no stream service in
between. Start one or both local feeds from this folder:

```sh
node simulator/start-local-vehicles.mjs
node simulator/start-local-drones.mjs
```

Wait for `Waiting for at least one client before sending data...`, then run `node serve.mjs`,
open <http://localhost:3000>, choose **Vehicles** or **Drones** under *Fallback: local
simulator* and click **Use local**. Filters then run in the browser instead of on the server.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `node simulator/start-velocity-vehicles.mjs` | Sends the vehicles to the ArcGIS Velocity feed in `.env` |
| `node simulator/start-velocity-drones.mjs` | Sends the drones to the ArcGIS Velocity feed in `.env` |
| `node simulator/start-local-vehicles.mjs` | Fallback: vehicles at `ws://127.0.0.1:8080/vehicles` |
| `node simulator/start-local-drones.mjs` | Fallback: drones at `ws://127.0.0.1:8081/drones` |
| `node serve.mjs` | Serves the app at <http://localhost:3000> |

All feeds loop seamlessly until you stop them. The Velocity scripts also accept a receiver URL
as an argument, which overrides `.env`.

## Notes

- All data is simulated. Vehicles, drones and timings are made up. The vehicles follow real
  streets from Esri's road data (Esri, TomTom). Include "SIMULATED" in the layer names when you
  share them.
- The local feeds use Web Mercator coordinates, the same as the basemap. A custom WebSocket
  feed must use the spatial reference of the map.
- With basic authentication, the start scripts run a small relay on your machine that adds the
  credentials — the simulator's command line cannot send them itself.
- The 3D models are Esri's realistic transportation models: a bus, van, delivery truck or pickup
  per vehicle type, and a small propeller airplane for the drones.
- The 3D city is the [Esri 3D Buildings](https://www.arcgis.com/home/item.html?id=b8fec5af7dfe4866b1b8ac2d2800f282)
  scene layer from ArcGIS Living Atlas; its sources are credited in the map's attribution.
- Delete the HTTP Receiver feeds when you are done.
