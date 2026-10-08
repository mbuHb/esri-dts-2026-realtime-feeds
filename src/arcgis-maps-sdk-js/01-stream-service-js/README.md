# 01 · Anatomy of a stream service

Publish your own stream layer in ArcGIS Velocity from a file on your laptop, look inside the
stream service, and add it to Map Viewer — no code.

The feed is **simulated**: eight made-up vehicles driving around central Frankfurt, sent to
ArcGIS Velocity by [ArcGIS Velocity Simulator](https://github.com/Esri/arcgis-velocity-simulator).

## Requirements

- ArcGIS Velocity (ArcGIS Online or ArcGIS Enterprise)
- [Node.js](https://nodejs.org/) 20 or later
- [Git](https://git-scm.com/)

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

2. **Create the feed.** In ArcGIS Velocity, create an **HTTP Receiver** feed:
   - Data format: **Esri JSON**
   - Sample data: paste one line from `simulator/data/vehicles.ws.txt`
   - Geometry: from the data (Web Mercator)
   - Track ID: `TRACKID`
   - Authentication: **None** or **Basic**

   Copy the **receiver URL** from the feed's details page.

3. **Publish the stream layer.** Create a real-time analytic with the feed as its source and a
   **stream layer** output named `Vehicles (SIMULATED)`. Start the analytic.

4. **Configure the simulator.** In this folder (`01-stream-service-js`), copy `.env.sample` to
   `.env` and fill in `VEHICLES_RECEIVER_URL`. If the feed uses basic authentication, also fill
   in `VEHICLES_USERNAME` and `VEHICLES_PASSWORD`. `.env` is git-ignored, so your credentials
   stay out of commits.

5. **Send the vehicles.** From the same folder:

   ```sh
   node simulator/start-velocity.mjs
   ```

   The simulator sends every vehicle's position once a second and loops until you press
   <kbd>Ctrl</kbd>+<kbd>C</kbd>.

6. **Look inside the stream service.** Open the stream layer item and its service URL (ending in
   `/StreamServer`):
   - Add `?f=json` to see the schema: the fields, the geometry type and `timeInfo` with
     `trackIdField: TRACKID`.
   - Use **Subscribe** on the service page to watch raw observations arrive.

7. **Add it to Map Viewer.** Open Map Viewer, choose **Add › Add layer from URL**, paste
   the stream service URL and add it. Zoom to Frankfurt am Main.

8. **Try it:**
   - Set a filter such as `VEHICLE_TYPE = 'bus'`. It runs on the server; only buses are sent.
   - Style it by `SPEED_KMH` and rotate the symbols by `HEADING`.

## Notes

- All data is simulated. Vehicles and timings are made up; the vehicles follow real streets from
  Esri's road data (Esri, TomTom). Include "SIMULATED" in the layer name when you share it.
- With basic authentication, the start script runs a small relay on your machine that adds the
  credentials — the simulator's command line cannot send them itself.
- Delete the feed when you are done.
