using ArcGIS.Core.Data;
using ArcGIS.Desktop.Editing;
using ArcGIS.Desktop.Framework;
using ArcGIS.Desktop.Framework.Contracts;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using ArcGIS.Desktop.Mapping;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using MessageBox = ArcGIS.Desktop.Framework.Dialogs.MessageBox;
using QueryFilter = ArcGIS.Core.Data.QueryFilter;
using DynamicLayerSample.Models;
using ArcGIS.Core.Data.Realtime;
using System.Windows.Shapes;

namespace DynamicLayerSample.Controls
{
    // SelectAlertCommand moved to Controls\SelectAlertCommand.cs

    public class Dockpane1ViewModel : DockPane
    {
        private const string _dockPaneID = "DynamicLayerSample_Controls_Dockpane1";
        readonly string startStreamIcon = @"pack://application:,,,/ArcGIS.Desktop.Resources;component/Images/StartStream32.png";
        readonly string startStreamDarkIcon = @"pack://application:,,,/ArcGIS.Desktop.Resources;component/DarkImages/StartStream32.png";
        readonly string stopStreamIcon = @"pack://application:,,,/ArcGIS.Desktop.Resources;component/Images/StopStream32.png";
        readonly string stopStreamDarkIcon = @"pack://application:,,,/ArcGIS.Desktop.Resources;component/DarkImages/StopStream32.png";
        readonly string trackViolationsIcon = @"pack://application:,,,/ArcGIS.Desktop.Resources;component/Images/ErrorInspector32.png";
        readonly string trackViolationsDarkIcon = @"pack://application:,,,/ArcGIS.Desktop.Resources;component/DarkImages/ErrorInspector32.png";

        StreamLayer _publicTransportLayer;
        FeatureLayer _speedZones;
        private bool _isTrackingAlerts = false;
        private System.Threading.CancellationTokenSource _trackingCancellationTokenSource;
        private HashSet<string> _trackedViolations;
        private FeatureLayer _violationLayer;
        private RealtimeCursor _rtc;

        protected Dockpane1ViewModel() 
        {
            _initAndStreamCommand = new RelayCommand(() => InitAndStreamOperation(), () => CanInitAndStream);
            _stopStreamCommand = new RelayCommand(() => StopStreamOperation(), () => IsLayerStreaming);
            _trackAlertsCommand = new RelayCommand(() => TrackAlertsOperation(), () => CanTrackAlerts);
            _selectAlertItemCommand = new SelectAlertCommand(this);
            Alerts = new ObservableCollection<SpeedViolationAlert>();
            _trackedViolations = new HashSet<string>();
        }

        /// <summary>
        /// Show the DockPane.
        /// </summary>
        internal static void Show()
        {
            DockPane pane = FrameworkApplication.DockPaneManager.Find(_dockPaneID);
            if (pane == null)
                return;

            pane.Activate();
        }

        #region ViewModel implementation
        /// <summary>
        /// Text shown near the top of the DockPane.
        /// </summary>
        private string _heading = "Speed zone monitoring";
        public string Heading
        {
            get => _heading;
            set => SetProperty(ref _heading, value);
        }

        private ImageSource _startStreamIcon = null;
        public ImageSource StartStreamIcon
        {
            get
            {
                if (_startStreamIcon == null)
                {
                    _startStreamIcon = ImageSource(startStreamIcon, startStreamDarkIcon);
                }
                return _startStreamIcon;
            }
        }

        private ImageSource _stopStreamIcon = null;
        public ImageSource StopStreamIcon
        {
            get
            {
                if (_stopStreamIcon == null)
                {
                    _stopStreamIcon = ImageSource(stopStreamIcon, stopStreamDarkIcon);
                }
                return _stopStreamIcon;
            }
        }

        private ImageSource _trackViolationsIcon = null;
        public ImageSource TrackViolationsIcon
        {
            get
            {
                if (_trackViolationsIcon == null)
                {
                    _trackViolationsIcon = ImageSource(trackViolationsIcon, trackViolationsDarkIcon);
                }
                return _trackViolationsIcon;
            }
        }

        private ObservableCollection<SpeedViolationAlert> _alerts;
        public ObservableCollection<SpeedViolationAlert> Alerts
        {
            get => _alerts;
            set => SetProperty(ref _alerts, value);
        }

        private SpeedViolationAlert _selectedAlert;
        public SpeedViolationAlert SelectedAlert
        {
            get => _selectedAlert;
            set => SetProperty(ref _selectedAlert, value);
        }

        private readonly RelayCommand _initAndStreamCommand;
        public ICommand InitAndStreamCommand
        {
            get { return _initAndStreamCommand; }
        }
        private void InitAndStreamOperation()
        {
            try
            {
                InitAndStream();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
        internal bool CanInitAndStream => MapView.Active != null && (_publicTransportLayer == null || !_publicTransportLayer.IsStreamingConnectionOpen);

        private readonly RelayCommand _stopStreamCommand;
        public ICommand StopStreamCommand
        {
            get { return _stopStreamCommand; }
        }
        private void StopStreamOperation()
        {
            try
            {
                StopStream();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
        internal bool IsLayerStreaming => MapView.Active != null && _publicTransportLayer != null && _publicTransportLayer.IsStreamingConnectionOpen;

        private readonly RelayCommand _trackAlertsCommand;
        public ICommand TrackAlertsCommand
        {
            get { return _trackAlertsCommand; }
        }

        private void InitializeViolationLayer(Map sceneMap)
        {
            try
            {
                if (sceneMap == null) return;

                // Look for existing violation layer
                _violationLayer = sceneMap?.FindLayers("Speed Violations")
                    .OfType<FeatureLayer>()
                    .FirstOrDefault();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error initializing violation layer: {ex.Message}");
            }
        }

        private void TrackAlertsOperation()
        {
            try
            {
                if (_isTrackingAlerts)
                {
                    StopTrackingAlerts();
                }
                else
                {
                    StartTrackingAlerts();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        internal bool CanTrackAlerts => MapView.Active != null && _publicTransportLayer != null && _speedZones != null;

        private string _trackAlertsButtonText = "Track speed violations";
        public string TrackAlertsButtonText
        {
            get => _trackAlertsButtonText;
            set => SetProperty(ref _trackAlertsButtonText, value);
        }

        private readonly ICommand _selectAlertItemCommand;
        public ICommand SelectAlertItemCommand
        {
            get { return _selectAlertItemCommand; }
        }

        private void StartTrackingAlerts()
        {
            _isTrackingAlerts = true;
            TrackAlertsButtonText = "Stop tracking";
            _trackingCancellationTokenSource = new System.Threading.CancellationTokenSource();
            _trackedViolations.Clear();

            Task.Run(async () =>
            {
                try
                {
                    while (_isTrackingAlerts && !_trackingCancellationTokenSource.Token.IsCancellationRequested)
                    {
                        await UpdateAlertsAsync();
                        await Task.Delay(1000);
                    }
                }
                catch (Exception ex)
                {
                    await FrameworkApplication.Current.Dispatcher.BeginInvoke(new Action(() =>
                    {
                        MessageBox.Show(ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }));
                }
            }, _trackingCancellationTokenSource.Token);
        }

        private void StopTrackingAlerts()
        {
            _isTrackingAlerts = false;
            TrackAlertsButtonText = "Track speed violations";
            _trackingCancellationTokenSource?.Cancel();
            
            FrameworkApplication.Current.Dispatcher.BeginInvoke(new Action(() =>
            {
                Alerts.Clear();
            }));
        }

        private async Task WriteViolationToFeatureClass(SpeedViolationAlert alert)
        {
            try
            {
                if (_violationLayer == null) return;

                var editOp = new EditOperation();
                editOp.Name = "Add Speed Violation";

                editOp.Create(_violationLayer, new Dictionary<string, object>
                {
                    { "VehicleID", alert.VehicleID },
                    { "VehicleSpeed", alert.VehicleSpeed },
                    { "SpeedLimit", alert.SpeedLimit },
                    { "ViolationSpeed", alert.ViolationSpeed },
                    { "SpeedZoneName", alert.SpeedZoneName },
                    { "ViolationTime", DateTime.Now },
                    { "Shape", alert.ViolationLocation }
                });

                await editOp.ExecuteAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error writing violation to feature class: {ex.Message}");
            }
        }

        internal void SelectAlertItemOperation(SpeedViolationAlert item)
        {
            if (item == null) return;

            QueuedTask.Run(() =>
            {
                try
                {
                    var mapView = MapView.Active;
                    if (mapView == null) return;

                    // Clear any existing selection
                    _publicTransportLayer.ClearSelection();

                    // Search for vehicle by VehicleID instead of ObjectID
                    var queryFilter = new QueryFilter
                    {
                        WhereClause = $"VehicleID = {item.VehicleID}"
                    };
                    var selection = _publicTransportLayer.Select(queryFilter);
                    mapView.ZoomTo(_publicTransportLayer, selection.GetObjectIDs(), new TimeSpan(0, 0, 1));
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Error selecting alert: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            });
        }

        protected static ImageSource ImageSource(string urlImageSource, string urlDarkImageSource)
        {
            var url = "";
            if (FrameworkApplication.ApplicationTheme == ApplicationTheme.Default)
            {
                url = urlImageSource;
            }
            else
            {
                url = urlDarkImageSource;
            }
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.UriSource = new Uri(url, UriKind.RelativeOrAbsolute);
            bmp.EndInit();
            return bmp;
        }
        #endregion

        #region Demo methods
        private void InitAndStream()
        {
            QueuedTask.Run(() =>
            {
                // Get the active map or scene from the active map view
                Map sceneMap = MapView.Active?.Map;

                _publicTransportLayer = sceneMap
                    .FindLayers("Public transport")
                    .OfType<StreamLayer>()
                    .FirstOrDefault();

                _speedZones = sceneMap
                    .FindLayers("Speed zones")
                    .OfType<FeatureLayer>()
                    .FirstOrDefault();

                // Find or create violation layer
                InitializeViolationLayer(sceneMap);

                if (_publicTransportLayer != null && !_publicTransportLayer.IsStreamingConnectionOpen)
                    _publicTransportLayer.StartStreaming();
            });
        }

        private void StopStream()
        {
            QueuedTask.Run(() =>
            {
                if (_publicTransportLayer != null)
                    _publicTransportLayer.StopStreaming();
            });
        }

        private async Task UpdateAlertsAsync()
        {
            await QueuedTask.Run(async () =>
            {
                try
                {
                    var newAlerts = new List<SpeedViolationAlert>();

                    // Get all features from public transport layer
                    using (var cursor = _publicTransportLayer.Search(null))
                    {
                        while (cursor.MoveNext())
                        {
                            using (var row = cursor.Current)
                            {
                                var feature = row as Feature;
                                if (feature == null) continue;

                                long vehicleID = Convert.ToInt64(feature["VehicleID"]);
                                double vehicleSpeed = Convert.ToDouble(feature["Speed"]);
                                var geometry = feature.GetShape();

                                // Check if vehicle is within any speed zone
                                var spatialFilter = new SpatialQueryFilter
                                {
                                    FilterGeometry = geometry,
                                    SpatialRelationship = SpatialRelationship.Intersects
                                };

                                using (var speedZoneCursor = _speedZones.Search(spatialFilter))
                                {
                                    while (speedZoneCursor.MoveNext())
                                    {
                                        using (var speedZoneRow = speedZoneCursor.Current)
                                        {
                                            var speedZoneFeature = speedZoneRow as Feature;
                                            if (speedZoneFeature != null)
                                            {
                                                string zoneName = speedZoneFeature["ZoneName"]?.ToString() ?? "Unknown";
                                                long speedLimit = Convert.ToInt64(speedZoneFeature["SpeedLimit"]);

                                                // Check if speed limit is violated
                                                if (vehicleSpeed > speedLimit)
                                                {
                                                    var alertKey = $"{vehicleID}_{zoneName}";

                                                    // Only add if this is the first violation for this vehicle in this zone
                                                    if (!_trackedViolations.Contains(alertKey))
                                                    {
                                                        _trackedViolations.Add(alertKey);

                                                        var violationAlert = new SpeedViolationAlert
                                                        {
                                                            VehicleID = vehicleID,
                                                            VehicleSpeed = vehicleSpeed,
                                                            SpeedLimit = speedLimit,
                                                            ViolationLocation = geometry,
                                                            SpeedZoneName = zoneName,
                                                            VehicleObjectID = vehicleID
                                                        };

                                                        newAlerts.Add(violationAlert);

                                                        // Write violation to feature class if layer exists
                                                        if (_violationLayer != null)
                                                        {
                                                            await WriteViolationToFeatureClass(violationAlert);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Update the alerts collection on the UI thread
                    await FrameworkApplication.Current.Dispatcher.BeginInvoke(new Action(() =>
                    {
                        foreach (var alert in newAlerts)
                        {
                            // Check if alert already exists to avoid duplicates
                            var existingAlert = Alerts.FirstOrDefault(a => a.AlertKey == alert.AlertKey);
                            if (existingAlert == null)
                            {
                                Alerts.Add(alert);
                            }
                        }
                    }));
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Error updating alerts: {ex.Message}");
                }
            });
        }
        #endregion

        #region UpdateAlertsAsyncAlternative
        private async Task UpdateWehicleAlertsAsync()
        {
            RealtimeFeatureClass rtfc = _publicTransportLayer.GetFeatureClass();
            SpatialQueryFilter sf = new SpatialQueryFilter()
            {
                WhereClause = "Speed > 30",
                //FilterGeometry = new Polygon(...)
            };
            await QueuedTask.Run(async () =>
            {
                _rtc = rtfc.Subscribe(sf, true);

                while (await _rtc.WaitForRowsAsync())
                {
                    while (_rtc.MoveNext())
                    {
                        switch(_rtc.Current.GetRowSource())
                        {
                            case RealtimeRowSource.EventInsert:
                                RealtimeFeature rtf = _rtc.Current as RealtimeFeature;
                                var vehicleID = rtf["VehicleID"].ToString();
                                // Do something...
                                continue;
                            default:
                                continue;
                        }
                    }
                }
            });
        }
        #endregion
    }

    /// <summary>
    /// Button implementation to show the DockPane.
    /// </summary>
    internal class Dockpane1_ShowButton : Button
    {
        protected override void OnClick()
        {
            Dockpane1ViewModel.Show();
        }
    }
}
