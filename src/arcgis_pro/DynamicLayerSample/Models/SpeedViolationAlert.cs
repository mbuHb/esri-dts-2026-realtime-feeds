using ArcGIS.Core.Geometry;

namespace DynamicLayerSample.Models
{
    public class SpeedViolationAlert
    {
        public long VehicleID { get; set; }
        public double VehicleSpeed { get; set; }
        public long SpeedLimit { get; set; }
        public double ViolationSpeed => VehicleSpeed - SpeedLimit;
        public Geometry ViolationLocation { get; set; }
        public string SpeedZoneName { get; set; }
        public long VehicleObjectID { get; set; }
        public string AlertKey => $"{VehicleID}_{SpeedZoneName}";
    }
}
