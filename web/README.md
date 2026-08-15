# Horizon Vision — Live 3D viewer (`web/`)

Interactive drone LiDAR + camera simulation. The moving sensor posts its
range-gated LiDAR subset, a rendered camera frame, and sim **labels** to the
Python edge process (`POST http://127.0.0.1:8765/ingest` at ~10 Hz).

The edge detector does **not** use those labels. It clusters the LiDAR cloud
and the viewer polls `GET /predictions` so green boxes (predicted) sit next
to cyan boxes (ground truth).

Same product model:
- fused sensor (LiDAR + camera pixels)
- 3D objects with bounding boxes (labels)
- detector predictions + JSON export

## Run locally

```bash
cd web
npm install
npm run dev
```

To feed the edge box and see predicted boxes, start the Python ingest first
(from the repo root):

```bash
PYTHONPATH=src python -m horizon_vision.main --source web
```

See the root README for the two-process walkthrough, the label-vs-prediction
split, and the no-browser fixture path.

## Controls
- **Drone / Third person** camera
- **Uniform / Irregular** traffic (lane departure + pedestrian in roadway)
- Traffic density and speed sliders (sensor moves; objects stay put)
- Hover a cyan box to see the sim class name
- Export collected label frames as JSON
