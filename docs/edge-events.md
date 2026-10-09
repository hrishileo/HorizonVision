# Camera-only edge events

The product path on the Jetson Orin Nano is monocular. LiDAR drivers and the
bird’s-eye experiments stay in the tree and are not used here. Georeferencing
into the phone/GPS incident feed (`docs/phone-gps-live.md`) is later: this
contract is the local event the edge publishes first.

Sim input is a **label** stream from the Vision-Quest Mag Mile recorder
(JSON Lines, one object-list per frame). Those records are ground truth for
scoring. The pipeline does not publish a label's true position as the event.

## Event

```json
{
  "class": "unknown",
  "unknown": true,
  "x": 9.0,
  "y": 16.0,
  "speed": 0.0,
  "lane": "mich-nb-2",
  "confidence": 0.62,
  "t": 1.2,
  "track_id": "deb-barrier"
}
```

| Field | Meaning |
| --- | --- |
| `class` | `vehicle` or `unknown` |
| `unknown` | `true` exactly when `class` is `unknown` |
| `x`, `y` | Metres east and south on the ground plane |
| `speed` | Non-negative m/s |
| `lane` | Lane id, or `null` |
| `confidence` | 0–1, from how steeply the ray hits the ground |
| `t` | Seconds |
| `track_id` | Persistent id |

Debris and blockades are always `unknown`. They still carry `x`, `y`, `lane`,
and `t` so a hub can warn that a lane is blocked. The real type (`barrier`,
`tire`, …) and kind (`debris` or `blockade`) stay on the label. They are not
event fields.

`x`/`y` match the Mag Mile ground axes: world `+X` east, `+Y` up, `+Z` south,
so event `y` is world `Z`.

The JSON Schema object lives at `EDGE_EVENT_JSON_SCHEMA` in
`horizon_vision.events.schema`.

## Label file

The parser in `horizon_vision.events.labels` reads the CAM0 JSONL from
Vision-Quest (`labels.jsonl`, schema 1). Y is up. The ground plane is the
world x/z plane at `y = 0`. A frame looks like:

```json
{
  "schema": 1,
  "groundTruth": true,
  "t": 1.167,
  "camera": {
    "position": {"x": 5.5, "y": 7.28, "z": 34.7},
    "agl": 7.28,
    "yaw": 0.0,
    "pitch": -0.39,
    "roll": 0.0,
    "intrinsics": {"fovY": 70, "width": 960, "height": 540, "fx": 385.6, "fy": 385.6, "cx": 480, "cy": 270}
  },
  "objects": [
    {
      "trackId": "veh-0",
      "class": "vehicle",
      "type": "vehicle",
      "kind": null,
      "laneId": "mich-nb-1",
      "position": {"x": 5.5, "y": 0, "z": 18.4},
      "speed": 8.7,
      "bbox": {"x": 458.8, "y": 242.9, "w": 42.4, "h": 61.2}
    },
    {
      "trackId": "deb-0",
      "class": "unknown",
      "type": "tire",
      "kind": "debris",
      "laneId": "mich-nb-2",
      "position": {"x": 9.0, "y": 0, "z": 16.0},
      "speed": null,
      "bbox": {"x": 500, "y": 260, "w": 20, "h": 16}
    }
  ]
}
```

`laneId` is the scene's 0-indexed id: `mich-nb-0` … `mich-sb-2`, `chi-eb-0` …
`chi-wb-1`, `rush-nb-0`, `rush-nb-1`, `conn-wb-0`, or `null` when the ground
point is off every travel lane. Debris uses the same field. `bbox` is
`{x, y, w, h}` from the top-left of the image. `position.y` is up and is 0
for a rig origin on the ground. `file` / `labelFile` name media and are not
read. The placeholder keys (`camera.pose`, `track_id`, `lane`, a bbox list)
still parse.

## Pipeline

1. Parse labels.
2. Cast the box’s bottom-center pixel through the CAM0 pinhole (Three.js YXZ,
   looking down local −Z) and intersect it with the ground plane `agl` metres
   below the camera. On recorder frames that plane is `y = 0`.
3. Hold a track per id. Smooth position and speed (exponential, default
   α = 0.5). Speed is the smoothed magnitude of the raw ground-plane step.
4. Emit one event per track per new timestamp after `min_hits` (default 3).
   Duplicate ids in a single frame are one hit. A second update at the same
   timestamp emits nothing.
5. Drop a track after `max_misses` consecutive frames without that id
   (default 5). It must reach `min_hits` again before it emits.

Published `x`/`y` are the smoothed estimates. The accuracy script scores
the raw ground-plane position, the smoothed position on the emitted event,
and the tracked speed against the label.

On a recorder frame the label `position` is the rig origin, while the ray
uses the bottom-center of the projected mesh. For a car that point is the
near edge, about half a vehicle length from the origin, so the position
error stays on the order of a couple of metres even when the ray is right.
A box whose bottom-center is the true ground point (the synthetic fixture)
comes back with only numerical error.

## Run

```bash
pip install -r requirements-dev.txt
PYTHONPATH=src python -m pytest
PYTHONPATH=src python -m horizon_vision.events.report \
  --fixture tests/fixtures/cam0-sample.labels.jsonl
```

`tests/fixtures/cam0-sample.labels.jsonl` is the CAM0 label sample from
Vision-Quest (no images). `tests/fixtures/mag_mile_labels.jsonl` is a short
synthetic clip whose boxes are the same pinhole applied to known ground
points, used to check round-trip error. Closed-form geometry is in
`tests/test_monocular.py`.
