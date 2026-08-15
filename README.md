# Horizon Vision

**Drone-based geo-mapping, 3D perception, and edge AI for real-time environment overlay and navigation.**

Horizon Vision captures data from a 3D LiDAR and camera on a drone, processes it on an edge computer (NVIDIA Jetson / similar), and produces structured perception outputs that can be streamed to a phone or car display.

This repo has two layers that share the same product model (sensor + objects + detections):

1. **Python edge pipeline** (`src/horizon_vision/`) — sensor drivers, timestamp sync, fusion, and a LiDAR-cluster detector.
2. **Live 3D web viewer** (`web/`) — interactive drone/third-person sim. The moving sensor posts its camera frame + LiDAR view (and sim **labels**) to the edge process.

## Sim labels vs detector output

The web scene already knows every object's center (`detectLive` in `web/src/sim/generateScene.ts`). That is **not** a detector. Those boxes are **train/eval labels** only.

| Stream | What it is | Who uses it |
| --- | --- | --- |
| LiDAR points + camera pixels | Sensor data | Detector forward pass |
| Ingest `labels` (or legacy `detections`) | Sim ground-truth boxes | Scoring only (precision / recall / BEV IoU) |
| Edge `pred=` lines and `/predictions` | Clustered boxes from the cloud | Viewer green boxes, sink log |

The edge `EdgeAIEngine` never copies sim centers into its output. v1 is a CPU Euclidean cluster on the range-gated XY cloud (ground removed, yaw-aware AABB, size-based class). No GPU.

In the viewer: **cyan** wireframes = sim labels in range. **Green** wireframes = detector predictions (appear when the edge process is live).

## Current Focus
- Sensor ingestion (3D LiDAR + Camera)
- Timestamp sync (exclusive nearest-pair, ~50 ms window)
- Static-scene LiDAR clustering on the edge
- Live 3D visualization (GT vs predicted)
- Local mapping foundation
- Clean architecture ready for ROS 2 / Jetson deployment

## Project Structure
```
HorizonVision/
├── src/horizon_vision/
│   ├── sensors/          # LiDAR & Camera drivers / interfaces
│   ├── perception/       # Time sync + fusion + cluster detector + metrics
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

## Run web + edge together (detector on)

Two processes, one shared clock (`t` is unix seconds from the browser). The viewer POSTs ~10 Hz samples to a loopback ingest server. The edge box pairs camera + LiDAR + labels inside a 50 ms window, **runs the cluster detector on the cloud**, and logs predicted boxes. No cloud services. Objects stay static (the sensor moves; cars do not).

**Terminal 1 — edge ingest + detector**
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

Open http://localhost:5173. Play the sim: the red sensor dot is the camera + LiDAR. The HUD **Edge ingest** line turns **Live** when the Python process is listening. Edge logs print `pred=` / `labels=` and P / R / IoU — predicted centers will be close to, but not a copy of, the sim labels.

Default ingest URL: `http://127.0.0.1:8765/ingest`  
Predictions for the viewer: `http://127.0.0.1:8765/predictions`  
Override with `--ingest-host` / `--ingest-port`, or `VITE_EDGE_INGEST_URL` on the web side.

### Without a browser (fixture replay)

Same parse → enqueue → pair → **detect** path as a live POST:

```bash
# Sparse ingest-pipe fixture (labels present; few points → few/no clusters)
PYTHONPATH=src python -m horizon_vision.main \
  --source fixture \
  --fixture tests/fixtures/web_samples.json

# Isolated vehicle cluster — prints a predicted box scored against the label
PYTHONPATH=src python -m horizon_vision.main \
  --source fixture \
  --fixture tests/fixtures/static_cluster.json
```

## Quick Start (edge only, synthetic drivers)

The original standalone loop still works. Simulated camera/LiDAR invent a road scene and are paired with the same 50 ms window (they are not stapled as "latest of each"). The same cluster detector runs on that cloud:

```bash
PYTHONPATH=src python -m horizon_vision.main --source simulated --config config/sensors.yaml
```

## Tests

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
cd web && npm test
```

Covers exclusive nearest-pair sync, the ingest path, and the detector contract: inference does not read ground-truth centers, clustering finds an isolated vehicle, metrics run on `static_cluster.json`.

## Hardware Target
- Drone + 3D LiDAR (Livox / Velodyne / Ouster style)
- RGB / RGB-D Camera
- NVIDIA Jetson Orin / Xavier (or equivalent edge GPU)

## Roadmap
1. ✅ Sensor interfaces + edge pipeline skeleton
2. ✅ Interactive 3D scene + live detection collection
3. ✅ Web sim → local ingest → timestamp-synced fused frames
4. ✅ Static-scene LiDAR cluster detector (sensor-only inference)
5. Real LiDAR + camera drivers (ROS 2 / native)
6. Learned 3D detection / semantic road segmentation
7. Local HD map / electronic horizon generation
8. Streaming to phone / car display (WebRTC + overlays)
