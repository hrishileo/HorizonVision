# Horizon Vision Architecture

## High-Level Data Flow

```
Drone
 ├── 3D LiDAR  ──┐
 ├── Camera    ──┤
 └── GNSS/IMU  ──┼──► Edge Computer (Jetson)
                 │         │
                 │         ├── Sensor Drivers
                 │         ├── Sensor Fusion
                 │         ├── Edge AI Engine (detection / segmentation)
                 │         ├── Georeference (sensor → WGS84)
                 │         └── Local Map Builder
                 │
                 └──► Confirmed road events (not raw sim frames)
                              │
                              ▼
                     Horizon cloud (dedupe + expire)
                              │
                     Phone app / car display / partner GPS feeds
```

Lab path today: `web/` simulates the drone view and POSTs samples to a local
ingest server on the edge process. Camera + LiDAR + sim labels are paired
inside a ~50 ms window (unpaired samples are dropped). The edge detector
reads only the cloud (and optional image). Flight path later:
see `docs/phone-gps-live.md`.

```
web/ (sensor dot)  --HTTP POST /ingest-->  edge ingest (127.0.0.1:8765)
                                              │
                                              ▼
                                    TimeSynchronizer (50 ms)
                                              │
                                              ▼
                         FusedFrame  (points + image + labels)
                                              │
                                              ▼
                         LidarClusterDetector (points only)
                                              │
                                              ▼
                    predictions + P/R/IoU vs labels
                         │              │
                         ▼              ▼
                    stub sink     GET /predictions (viewer)
```

## Current Status (v0.4)

- Abstract LiDAR and Camera drivers (simulated, or `web` ingest)
- Exclusive nearest-timestamp fusion (not "latest of each")
- Local HTTP ingest so the 3D viewer feeds the edge box
- Edge AI: Euclidean LiDAR clustering (not a sim-label passthrough)
- Viewer shows GT (cyan) vs predicted (green) boxes
- Rolling local map
- Interactive 3D viewer (`web/`) for drone/third-person, density, irregular traffic
- Fixture replay path (`--source fixture`) to prove the pipe without a browser
- Clean entry point ready for real hardware drivers

## Next Steps

1. Replace simulated drivers with real LiDAR (Livox / Velodyne) and camera
2. Optional learned detector (ONNX / TensorRT) on top of this cluster baseline
3. Add GNSS/IMU and publish georeferenced events (not simulated XYZ)
4. Stream events to a Horizon phone app, then partner GPS / electronic horizon
5. Add ROS 2 wrappers when hardware integration starts
