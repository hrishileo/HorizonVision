# Horizon Vision — Live 3D viewer (`web/`)

Interactive drone LiDAR + camera simulation. The moving sensor posts its
range-gated LiDAR subset, a camera stub, and live detections to the Python
edge process (`POST http://127.0.0.1:8765/ingest` at ~10 Hz).

Same product model:
- fused sensor (LiDAR + camera)
- 3D objects with bounding boxes
- live detections + JSON export

## Run locally

```bash
cd web
npm install
npm run dev
```

To feed the edge box, start the Python ingest first (from the repo root):

```bash
PYTHONPATH=src python -m horizon_vision.main --source web
```

See the root README for the two-process walkthrough and the no-browser fixture path.

## Controls
- **Drone / Third person** camera
- **Uniform / Irregular** traffic (lane departure + pedestrian in roadway)
- Traffic density and speed sliders
- Hover a box to see the class name
- Export collected detection frames as JSON
