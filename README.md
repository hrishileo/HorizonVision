# Horizon Vision

**Drone-based geo-mapping, 3D perception, and edge AI for real-time environment overlay and navigation.**

Horizon Vision captures data from a 3D LiDAR and camera on a drone, processes it on an edge computer (NVIDIA Jetson / similar), and produces structured perception outputs that can be streamed to a phone or car display.

This repo has two layers that share the same product model (sensor + objects + detections):

1. **Python edge pipeline** (`src/horizon_vision/`) — original sensor drivers, fusion, and edge AI skeleton.
2. **Live 3D web viewer** (`web/`) — interactive drone/third-person sim, traffic density, uniform/irregular scenes, hover labels, and JSON data collection.

## Current Focus
- Camera-only edge events for a Jetson Orin Nano (monocular; LiDAR is not on this path)
- Label → tracked event pipeline and a ground-plane accuracy check
- Live 3D visualization in `web/` (lab viewer)
- LiDAR drivers, fusion, and mapping remain in the tree and are not part of the edge-event path

## Camera-only edge events
```bash
pip install -r requirements-dev.txt
PYTHONPATH=src python -m pytest
PYTHONPATH=src python -m horizon_vision.events.report \
  --fixture tests/fixtures/cam0-sample.labels.jsonl
```
Contract and recorder alignment: `docs/edge-events.md`.

## Hub detour (Mag Mile)
The hub turns lane-state updates into driver reroute alerts. The street graph is a few approximate blocks of Michigan Avenue plus Rush, Wabash, and the Ohio–Chicago cross streets (`horizon_vision.hub`). Michigan lane ids are the Vision-Quest scene ids from `src/lib/guide/city.ts`: `mich-nb-0`, `mich-nb-1`, `mich-nb-2`, `mich-sb-0`, `mich-sb-1`, `mich-sb-2` (inner lane is 0). Chicago Avenue crossings use `chi-eb-0` and `chi-wb-0`. A mock phone sink writes alerts as local JSONL.

```bash
PYTHONPATH=src python -m horizon_vision.hub \
  --output /tmp/debris_alerts.jsonl \
  --summary /tmp/debris_summary.txt
```

## Project Structure
```
HorizonVision/
├── src/horizon_vision/
│   ├── sensors/          # LiDAR & Camera drivers / interfaces
│   ├── perception/       # Fusion + Edge AI
│   ├── mapping/          # Local map building
│   ├── hub/              # Detour graph, A* reroute, JSONL alerts
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
- Drone + RGB camera on an NVIDIA Jetson Orin Nano (camera-only edge events)
- LiDAR interfaces remain under `src/horizon_vision/sensors/` and are not used by that path

## Roadmap
1. ✅ Sensor interfaces + edge pipeline skeleton
2. ✅ Interactive 3D scene + live detection collection
3. Real LiDAR + camera drivers (ROS 2 / native)
4. 3D object detection + semantic road segmentation
5. Local HD map / electronic horizon generation
6. Streaming to phone / car display (WebRTC + overlays)
