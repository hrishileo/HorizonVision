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

## Tailgating

For consecutive vehicles in the same lane, time headway is the gap between
the leader's rear and the follower's front, divided by the follower's speed.
The corpus stores the rig origin, not the bumpers, and does not export
length. The gap uses a centered length (default 4.4 m, Mag Mile `CAR_L`).
Only `class: vehicle` rows are paired. Debris keeps its `laneId` on the
label and is not a leader or a follower.

Flag when headway is strictly below a threshold (default 2.0 s) and the
follower is moving (default speed ≥ 1.0 m/s). A stopped or creeping follower
is queued traffic and is not an event. A stopped leader does not change the
test: headway uses the follower's speed only.

The same follower, leader, and lane must stay under the threshold for
`persist_s` (default 0.5 s) before the first event, and on each later frame
while that holds. A one-frame dip does not emit. A lane change, or a new
leader, starts the window over. Only adjacent vehicles are paired. Travel
direction comes from the scene lane id (`nb` toward −Z, `sb` toward +Z,
`eb` toward +X, `wb` toward −X). A non-positive gap is not a following gap.

`confidence` is 1 when the positions and speeds are ground-truth labels.
The JSON Schema object is `TAILGATE_EVENT_JSON_SCHEMA`.

```json
{
  "follower_track_id": "veh-13",
  "leader_track_id": "veh-12",
  "lane": "mich-sb-0",
  "headway_s": 1.5894965934823853,
  "gap_m": 11.365969744954844,
  "follower_speed": 7.15067260386727,
  "confidence": 1.0,
  "t": 1.6666666666666685
}
```

```bash
PYTHONPATH=src python -m horizon_vision.events.tailgate \
  --fixture tests/fixtures/cam0-sample.labels.jsonl \
  --output tests/fixtures/cam0_tailgate_events.jsonl
```

That CAM0 sample already contains close following under 2 s, including
`veh-13` behind `veh-12` in `mich-sb-0`. The edge cases (open gap, stopped
traffic, a shorter threshold, a one-frame blip, a lane change) are unit
tests, not a second label file.
