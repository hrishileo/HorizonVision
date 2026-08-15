# Horizon Vision

**Drone-based geo-mapping, 3D perception, and edge AI for real-time environment overlay and navigation.**

Horizon Vision captures data from a 3D LiDAR and camera on a drone, processes it on an edge computer (NVIDIA Jetson / similar), and produces structured perception outputs that can be streamed to a phone or car display.

This repo has two layers that share the same product model (sensor + objects + detections):

1. **Python edge pipeline** (`src/horizon_vision/`) — original sensor drivers, fusion, and edge AI skeleton.
2. **Live 3D web viewer** (`web/`) — interactive drone/third-person sim, traffic density, uniform/irregular scenes, hover labels, and JSON data collection.

## Current Focus
- Sensor ingestion (3D LiDAR + Camera)
- Edge AI perception pipeline
- Live 3D visualization + detection logging
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
├── web/                  # Live 3D viewer (this iteration)
├── config/               # Sensor & pipeline configuration
├── docs/
└── requirements.txt
```

## Quick Start (Edge Computer)
```bash
pip install -r requirements.txt
python -m horizon_vision.main --config config/sensors.yaml
```

## Quick Start (Live 3D Viewer)
```bash
cd web
npm install
npm run dev
```

## Hardware Target
- Drone + 3D LiDAR (Livox / Velodyne / Ouster style)
- RGB / RGB-D Camera
- NVIDIA Jetson Orin / Xavier (or equivalent edge GPU)

## Roadmap
1. ✅ Sensor interfaces + edge pipeline skeleton
2. ✅ Interactive 3D scene + live detection collection
3. Real LiDAR + camera drivers (ROS 2 / native)
4. 3D object detection + semantic road segmentation
5. Local HD map / electronic horizon generation
6. Streaming to phone / car display (WebRTC + overlays)
