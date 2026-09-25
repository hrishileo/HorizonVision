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

The parser in `horizon_vision.events.labels` is the only place that reads
recorder keys. Align it there when the Vision-Quest export lands. Expected
shape:

```json
{
  "t": 0.0,
  "camera": {
    "pose": {"x": 0.0, "y": 18.0, "z": -12.0, "agl": 18.0, "yaw": 0.0, "pitch": -0.55, "roll": 0.0},
    "intrinsics": {"fov": 49.5, "width": 640, "height": 480, "focal_length": 520.0, "principal_point": [320.0, 240.0]}
  },
  "objects": [
    {
      "track_id": "veh-12",
      "class": "vehicle",
      "type": "car",
      "kind": null,
      "lane": "mich-nb-1",
      "bbox": [0, 0, 20, 10],
      "position": {"x": 5.5, "y": 0.0, "z": 4.0},
      "speed": 8.0
    }
  ]
}
```

`image` is ignored. Angles are radians. `focal_length` is pixels. `position`
is world metres with `y` up. `bbox` is `[u, v, w, h]` from the top-left, `+v`
down. Integer track ids are accepted and stored as strings.

## Pipeline

1. Parse labels.
2. Cast the box’s bottom-center pixel through the pinhole camera and intersect
   it with the plane `agl` metres below the camera.
3. Hold a track per id. Smooth position and speed (exponential, default
   α = 0.5). Speed is the smoothed magnitude of the raw ground-plane step.
4. Emit one event per track per new timestamp after `min_hits` (default 3).
   Duplicate ids in a single frame are one hit. A second update at the same
   timestamp emits nothing.
5. Drop a track after `max_misses` consecutive frames without that id
   (default 5). It must reach `min_hits` again before it emits.

Published `x`/`y` are the smoothed estimates. The accuracy script scores
three things against the label’s truth: the raw ground-plane position, the
smoothed position on the emitted event (this lags a constant-speed track),
and the tracked speed.

## Run

```bash
pip install -r requirements-dev.txt
PYTHONPATH=src python -m pytest
PYTHONPATH=src python -m horizon_vision.events.report \
  --fixture tests/fixtures/mag_mile_labels.jsonl
```

The fixture is a short Mag Mile label clip: a car in `mich-nb-1`, a barrier
blocking `mich-nb-2`, and a tire with no lane. Pixel boxes are the pinhole
projection of each true ground point, so the report measures numerical
round-trip error. Closed-form geometry (a pixel offset equals a known number
of metres) is in `tests/test_monocular.py`.
