# 03 · Real-time alerting in the browser

Analysis on live feeds, entirely in the browser. Every observation is tested against a
restricted area the moment it arrives; crossing the boundary raises an alert. Watch several feeds
at once — vehicles and drones together. A live chart shows the incoming rate, a button summarises
everything on the map, and the view switches between 2D and 3D. **Show code** displays the
alerting code the app runs.

Two **simulated** datasets are included, replayed by
[ArcGIS Velocity Simulator](https://github.com/Esri/arcgis-velocity-simulator). In each, one
track crosses the restricted area 40 seconds after the replay starts:

- **Vehicles** — eight made-up vehicles driving the streets of central Frankfurt. The delivery
  van **VH-07** drives through the restricted area.
- **Drones** — eight made-up drones flying over Frankfurt, with an altitude (`ALT_M`) for 3D.
  The delivery drone **DR-07** flies through the restricted area.

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
   source and a **stream layer** output, and start it.

4. **Start the app.** From this folder (`03-browser-alerting-js`):

   ```sh
   node serve.mjs
   ```

   Open <http://localhost:3001>, paste the vehicles stream service URL (ending in
   `/StreamServer`) into **Stream service URL** and click **Add**. Add the drones stream service
   the same way to watch both at once; remove a source with its **✕**.

5. **Send the vehicles.** In a second terminal, from the same folder:

   ```sh
   node simulator/start-velocity-vehicles.mjs
   ```

   VH-07 enters the restricted area 40 seconds after the script starts (plus a few seconds for
   the trip through ArcGIS Velocity) and leaves 50 seconds later; it comes round again every
   5 minutes. **To replay the alert on cue, stop the script and start it again.**

6. **Try it:**
   - **2D / 3D** — in 3D the restricted area is a 150 m column; vehicles become 3D models and
     drones fly at their altitude.
   - **Summarise what is on the map** — a point-in-time count of everything on the map, by type.
   - **Show code** — the alerting code behind all of the above.
   - **Drones** — run `node simulator/start-velocity-drones.mjs` and add the drones stream
     service. DR-07 flies into the column 40 seconds after the script starts.

## Fallback: without ArcGIS Velocity

The app can also connect straight to the simulator on your machine, with no stream service in
between. Start a local feed from this folder:

```sh
node simulator/start-local-vehicles.mjs
```

Wait for `Waiting for at least one client before sending data...`, then run `node serve.mjs`,
open <http://localhost:3001>, choose **Vehicles** under *Fallback: local simulator* and click
**Add local**. The clock starts when the app connects:

| After | What happens |
| ----- | ------------ |
| 40 s | VH-07 enters the restricted area — an alert appears and the area flashes |
| 90 s | VH-07 leaves — a second alert |
| every 5 min | VH-07 comes round again |

For drones, also run `node simulator/start-local-drones.mjs`, choose **Drones** and click
**Add local**: DR-07 enters 40 s after it connects and again every 7½ minutes.

The feeds loop seamlessly until you stop them. **To restart the 40-second countdown, stop the
feed with <kbd>Ctrl</kbd>+<kbd>C</kbd>, start it again, then remove the source and add it again.**

## Scripts

| Command | What it does |
| ------- | ------------ |
| `node simulator/start-velocity-vehicles.mjs` | Sends the vehicles to the ArcGIS Velocity feed in `.env`; VH-07 enters after 40 s |
| `node simulator/start-velocity-drones.mjs` | Sends the drones to the ArcGIS Velocity feed in `.env`; DR-07 enters after 40 s |
| `node simulator/start-local-vehicles.mjs` | Fallback: vehicles at `ws://127.0.0.1:8080/vehicles` |
| `node simulator/start-local-vehicles-fast.mjs` | The same, four times faster; VH-07 enters after 10 s |
| `node simulator/start-local-drones.mjs` | Fallback: drones at `ws://127.0.0.1:8081/drones` |
| `node serve.mjs` | Serves the app at <http://localhost:3001> |

The Velocity scripts also accept a receiver URL as an argument, which overrides `.env`.

## Notes

- All data is simulated. Vehicles, drones, timings and the restricted area are made up. The
  vehicles follow real streets from Esri's road data (Esri, TomTom).
- An alert needs two observations of a track, one on each side of the boundary. A track that
  appears for the first time inside the area does not raise one.
- The browser only sees what it receives. For alerts that must never be missed, run the geofence
  on the server in ArcGIS Velocity instead.
- With basic authentication, the start scripts run a small relay on your machine that adds the
  credentials — the simulator's command line cannot send them itself.
- The 3D models are Esri's realistic transportation models: a bus, van, delivery truck or pickup
  per vehicle type, and a small propeller airplane for the drones.
- The 3D city is the [Esri 3D Buildings](https://www.arcgis.com/home/item.html?id=b8fec5af7dfe4866b1b8ac2d2800f282)
  scene layer from ArcGIS Living Atlas; its sources are credited in the map's attribution.
- Delete the HTTP Receiver feeds when you are done.
