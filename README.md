# Getting Started with Real-Time Feeds in Your Applications

Session resources for the **2026 Esri European Partner Conference and Developer & Technology Summit**, Frankfurt, Germany, 21 October 2026.

Presenters: Mantas Bukauskas and Mindaugas Rasiukevičius

## About the session

Apps that use real-time feeds give your users a more engaging and dynamic experience. ArcGIS supports ingesting and analyzing feeds natively in its server products, ArcGIS Velocity and ArcGIS GeoEvent Server. Developers can also use the ArcGIS Maps SDKs and the ArcGIS Pro SDK for .NET to ingest, analyze, visualize and interact with feeds. This session gives an overview of all these approaches, so you can bring real-time feeds to life in your own apps.

The session follows four steps: **ingest → analyze → visualize → interact**.

| Part | Presenter | Topics |
| ---- | --------- | ------ |
| Web | Mantas Bukauskas | Stream services, Map Viewer, ArcGIS Maps SDK for JavaScript, alerting in the browser (demos 01–03) |
| Desktop and native | Mindaugas Rasiukevičius | ArcGIS Pro, ArcGIS Pro SDK for .NET, ArcGIS Maps SDK for .NET (demos 04–06) |

## Demos

### Web — ArcGIS Maps SDK for JavaScript

| #   | Demo | Stack |
| --- | ---- | ----- |
| 01  | [Anatomy of a stream service](src/arcgis-maps-sdk-js/01-stream-service-js/) | ArcGIS Velocity, Map Viewer |
| 02  | [StreamLayer with the Maps SDK for JavaScript](src/arcgis-maps-sdk-js/02-maps-sdk-js/) — 2D and 3D, vehicles and drones | ArcGIS Velocity, ArcGIS Maps SDK for JavaScript 5.1 |
| 03  | [Real-time alerting in the browser](src/arcgis-maps-sdk-js/03-browser-alerting-js/) — 2D and 3D, vehicles and drones | ArcGIS Velocity, ArcGIS Maps SDK for JavaScript 5.1 |

The web demos run on a simulated feed replayed by [ArcGIS Velocity Simulator](https://github.com/Esri/arcgis-velocity-simulator). Each folder has its own step-by-step instructions.

### Desktop — ArcGIS Pro and .NET

| #   | Demo | Stack |
| --- | ---- | ----- |
| 04  | [Stream layers in ArcGIS Pro](src/arcgis_pro/Data/) — `Demo.aprx` project with a `Public transport` stream layer and `Speed zones` polygons | ArcGIS Pro 3.5 |
| 05  | [Speed-zone violation tracking add-in](src/arcgis_pro/DynamicLayerSample/) — dockpane that starts/stops the stream, detects vehicles over the zone `SpeedLimit` and lists violations | ArcGIS Pro SDK for .NET 3.5, .NET 8 |
| 06a | [Add dynamic entity layer](src/arcgis-maps-sdk-dotnet/WPF/WPF.Viewer/Samples/Layers/AddDynamicEntityLayer/) — connect to a stream service, set track display and purge options | ArcGIS Maps SDK for .NET 300.1 (WPF) |
| 06b | [Add custom dynamic entity data source](src/arcgis-maps-sdk-dotnet/WPF/WPF.Viewer/Samples/Layers/AddCustomDynamicEntityDataSource/) — feed your own observations into a `DynamicEntityLayer` | ArcGIS Maps SDK for .NET 300.1 (WPF) |

All desktop demo data is simulated and self-authored. The `Public transport` stream layer (04, 05) and the city traffic stream service (06a) are replayed by ArcGIS Velocity Simulator into ArcGIS Velocity stream services; the regatta observations in 06b are a simulated JSON file.

Demo 04 and 05 work together: open `src/arcgis_pro/Data/Demo.aprx`, then build and run the add-in from `DynamicLayerSample.sln` (Visual Studio with the ArcGIS Pro SDK installed). The add-in expects layers named exactly `Public transport` and `Speed zones` — see its [readme](src/arcgis_pro/DynamicLayerSample/readme.md).

Demos 06a and 06b are hosted in a trimmed copy of the ArcGIS Maps SDK for .NET sample viewer. Open `src/arcgis-maps-sdk-dotnet/WPF/ArcGIS.WPF.Viewer.Net.sln`, run `WPF.Viewer` and pick the sample from the **Layers** category. The SDK version is pinned in `src/arcgis-maps-sdk-dotnet/Directory.Packages.props`.

The demo source code will be published in this repository after the session.

## Repository structure

```text
src/
├── arcgis-maps-sdk-js/                 # Web demos (Mantas)
│   ├── 01-stream-service-js/           #   simulator → ArcGIS Velocity stream service
│   ├── 02-maps-sdk-js/                 #   StreamLayer app, 2D/3D
│   └── 03-browser-alerting-js/         #   geofence alerting in the browser
├── arcgis_pro/                         # ArcGIS Pro demos (Mindaugas)
│   ├── Data/                           #   Demo.aprx project, Default.gdb, Demo.atbx
│   └── DynamicLayerSample/             #   ArcGIS Pro SDK for .NET add-in
└── arcgis-maps-sdk-dotnet/             # ArcGIS Maps SDK for .NET demos (Mindaugas)
    ├── Directory.Packages.props        #   pinned SDK version
    ├── Samples.Shared/                 #   sample viewer infrastructure
    └── WPF/                            #   WPF sample viewer
        └── WPF.Viewer/Samples/Layers/  #   AddDynamicEntityLayer, AddCustomDynamicEntityDataSource
```

## Resources

- [ArcGIS Velocity](https://doc.arcgis.com/en/velocity/get-started/what-is-arcgis-velocity.htm), with [what's new](https://doc.arcgis.com/en/velocity/reference/whats-new.htm)
- [ArcGIS GeoEvent Server](https://enterprise.arcgis.com/en/geoevent/latest/get-started/what-is-arcgis-geoevent-server.htm), with [what's new](https://enterprise.arcgis.com/en/geoevent/latest/get-started/whats-new-in-geoevent-server.htm)
- [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/), with [release notes](https://developers.arcgis.com/javascript/latest/release-notes/)
- [ArcGIS Pro SDK for .NET](https://pro.arcgis.com/en/pro-app/latest/sdk/)
- [ArcGIS Maps SDK for .NET — work with dynamic entities](https://developers.arcgis.com/net/real-time/work-with-dynamic-entities/)

## License

[MIT](LICENSE)
