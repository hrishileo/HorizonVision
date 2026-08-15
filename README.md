# Horizon Vision

**Drone-based geo-mapping, 3D perception, and edge AI for real-time environment overlay and navigation.**

Horizon Vision captures data from a 3D LiDAR and camera on a drone, processes it on an edge computer (NVIDIA Jetson / similar), and produces structured perception outputs that can be streamed to a phone or car display.

This repo has two layers that share the same product model (sensor + objects + detections):

1. **Python edge pipeline** (`src/horizon_vision/`) — sensor drivers, timestamp sync, fusion, and edge AI skeleton.
2. **Live 3D web viewer** (`web/`) — interactive drone/third-person sim. The moving sensor posts its camera + LiDAR view (and detections) to the edge process.

## Current Focus
- Sensor ingestion (3D LiDAR + Camera)
- Timestamp sync (exclusive nearest-pair, ~50 ms window)
- Live 3D visualization + detection logging
- Local mapping foundation
- Clean architecture ready for ROS 2 / Jetson deployment

## Project Structure
```
HorizonVision/
├── src/horizon_vision/
│   ├── sensors/          # LiDAR & Camera drivers / interfaces
│   ├── perception/       # Time sync + fusion + Edge AI
│   ├── ingest/           # Local HTTP ingest (web sim → edge)
│   ├── mapping/          # Local map building
│   ├── sink.py           # Stub sink for synced samples
│   └── main.py           # Entry point for edge computer
├── web/                  # Live 3D viewer
├── tests/
├── config/               # Sensor & pipeline configuration
├── docs/
└── requirements.txt
```

## Run web + edge together (local)

Two processes, one shared clock (`t` is unix seconds from the browser). The viewer POSTs ~10 Hz samples to a loopback ingest server. The edge box pairs camera + LiDAR + detections inside a 50 ms window and logs fused frames. No cloud services.

**Terminal 1 — edge ingest**
```bash
pip install -r requirements.txt
PYTHONPATH=src python -m horizon_vision.main --source web --config config/sensors.yaml
```

**Terminal 2 — live 3D viewer**
```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173. Play the sim: the red sensor dot is the camera + LiDAR. The HUD **Edge ingest** line turns **Live** when the Python process is listening. Edge logs should show the same detections that appear in the viewer (label, distance, center).

Default ingest URL: `http://127.0.0.1:8765/ingest`  
Override with `--ingest-host` / `--ingest-port`, or `VITE_EDGE_INGEST_URL` on the web side.

### Without a browser (fixture replay)

Same parse → enqueue → pair path as a live POST, using recorded payloads:

```bash
PYTHONPATH=src python -m horizon_vision.main \
  --source fixture \
  --fixture tests/fixtures/web_samples.json
```

## Quick Start (edge only, synthetic drivers)

The original standalone loop still works. Simulated camera/LiDAR invent a road scene and are paired with the same 50 ms window (they are not stapled as "latest of each"):

```bash
PYTHONPATH=src python -m horizon_vision.main --source simulated --config config/sensors.yaml
```

## Tests

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

Covers exclusive nearest-pair sync (in-window / out-of-window / drop unpaired) and the ingest path (payload parse, fake HTTP POSTs, fixture replay).

## Hardware Target
- Drone + 3D LiDAR (Livox / Velodyne / Ouster style)
- RGB / RGB-D Camera
- NVIDIA Jetson Orin / Xavier (or equivalent edge GPU)

## Roadmap
1. ✅ Sensor interfaces + edge pipeline skeleton
2. ✅ Interactive 3D scene + live detection collection
3. ✅ Web sim → local ingest → timestamp-synced fused frames
4. Real LiDAR + camera drivers (ROS 2 / native)
5. 3D object detection + semantic road segmentation
6. Local HD map / electronic horizon generation
7. Streaming to phone / car display (WebRTC + overlays)
