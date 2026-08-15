# Horizon Vision — Live 3D viewer (`web/`)

Interactive drone LiDAR + camera simulation. This is the **visualization and data-collection layer** on top of the original Python edge pipeline in `src/horizon_vision/`.

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

## Controls
- **Drone / Third person** camera
- **Uniform / Irregular** traffic (lane departure + pedestrian in roadway)
- Traffic density and speed sliders
- Hover a box to see the class name
- Export collected detection frames as JSON
