# Horizon Vision Architecture

## High-Level Data Flow

```
Drone
 ├── 3D LiDAR  ──┐
 └── Camera    ──┼──► Edge Computer (Jetson)
                 │         │
                 │         ├── Sensor Drivers
                 │         ├── Sensor Fusion
                 │         ├── Edge AI Engine (detection / segmentation)
                 │         └── Local Map Builder
                 │
                 └──► Perception Output + Local Map
                              │
                              ▼
                     Phone / Car Display
                     (WebRTC + AR overlays)
```

## Current Status (v0.1)

- Abstract LiDAR and Camera drivers (simulated for now)
- Sensor fusion package
- Edge AI engine with placeholder 3D detections
- Rolling local map
- Clean entry point ready for real hardware drivers

## Next Steps

1. Replace simulated drivers with real LiDAR (Livox / Velodyne) and camera
2. Integrate TensorRT or ONNX models for real 3D object detection
3. Add ROS 2 wrappers
4. Stream perception results to mobile client
