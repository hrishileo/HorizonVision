# Horizon Vision

**Drone-based geo-mapping, 3D perception, and edge AI for real-time environment overlay and navigation.**

Horizon Vision captures data from a 3D LiDAR and camera on a drone, processes it on an edge computer (NVIDIA Jetson / similar), and produces structured perception outputs that can be streamed to a phone or car display.

## Current Focus
- Sensor ingestion (3D LiDAR + Camera)
- Edge AI perception pipeline
- Local mapping foundation
- Clean architecture ready for ROS 2 / Jetson deployment

## Project Structure
```
HorizonVision/
├── src/horizon_vision/
│   ├── sensors/          # LiDAR & Camera drivers / interfaces
│   ├── perception/       # Fusion + Edge AI
│   ├── mapping/          # Local map building
│   └── main.py           # Entry point for edge computer
├── config/               # Sensor & pipeline configuration
├── launch/               # ROS 2 style launch files (future)
├── docker/               # Edge deployment containers
└── docs/
```

## Quick Start (Edge Computer)
```bash
pip install -r requirements.txt
python -m horizon_vision.main --config config/sensors.yaml
```

## Hardware Target
- Drone + 3D LiDAR (Livox / Velodyne / Ouster style)
- RGB / RGB-D Camera
- NVIDIA Jetson Orin / Xavier (or equivalent edge GPU)

## Roadmap
1. ✅ Sensor interfaces + edge pipeline skeleton
2. Real LiDAR + camera drivers (ROS 2 / native)
3. 3D object detection + semantic road segmentation
4. Local HD map / electronic horizon generation
5. Streaming to phone / car display (WebRTC + overlays)

---
Private repository for Horizon Vision development.
