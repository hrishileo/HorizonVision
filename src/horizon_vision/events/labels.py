"""Parser for Vision-Quest recorder labels.

This is the only module that knows the recorder's JSON keys. When that
export lands, align field names here. Callers see :class:`FrameLabels`,
not raw dicts.

These records are ground-truth labels for scoring.

World frame (Mag Mile): ``+X`` east, ``+Y`` up, ``+Z`` south, ground ``Y = 0``.
Angles are radians. ``focal_length`` is pixels (square pixels). ``bbox`` is
``[u, v, w, h]`` with origin at the top-left of the image, ``+u`` right,
``+v`` down. An ``image`` field is ignored so frames can later name a file
without this parser loading media.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


class LabelParseError(ValueError):
    """A label frame did not match the recorder schema this parser expects."""


@dataclass(frozen=True, slots=True)
class BBox:
    """Pixel box. ``u, v`` is the top-left corner."""

    u: float
    v: float
    w: float
    h: float

    @property
    def ground_contact(self) -> tuple[float, float]:
        """Bottom-center pixel, where the object meets the ground plane."""
        return (self.u + self.w / 2.0, self.v + self.h)


@dataclass(frozen=True, slots=True)
class CameraIntrinsics:
    fov_deg: float
    width: int
    height: int
    focal_length_px: float
    cx: float
    cy: float


@dataclass(frozen=True, slots=True)
class CameraPose:
    x: float
    y: float
    z: float
    agl: float
    yaw: float
    pitch: float
    roll: float


@dataclass(frozen=True, slots=True)
class ObjectLabel:
    """One labeled object. Truth fields are for scoring, not for publishing."""

    track_id: str
    cls: str
    unknown: bool
    type_name: str
    kind: str | None
    lane: str | None
    bbox: BBox
    truth_x: float
    truth_y_up: float
    truth_z: float
    truth_speed: float | None

    @property
    def truth_ground(self) -> tuple[float, float]:
        """Horizontal truth in the edge-event frame: east, south."""
        return (self.truth_x, self.truth_z)


@dataclass(frozen=True, slots=True)
class FrameLabels:
    t: float
    pose: CameraPose
    intrinsics: CameraIntrinsics
    objects: tuple[ObjectLabel, ...]


def read_jsonl(path: str | Path) -> list[FrameLabels]:
    frames: list[FrameLabels] = []
    file_path = Path(path)
    with file_path.open(encoding="utf-8") as handle:
        for line_no, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:
                raise LabelParseError(f"{file_path}:{line_no}: {exc}") from exc
            try:
                frames.append(parse_frame(payload))
            except LabelParseError as exc:
                raise LabelParseError(f"{file_path}:{line_no}: {exc}") from exc
    return frames


def parse_frame(data: Mapping[str, Any]) -> FrameLabels:
    if not isinstance(data, Mapping):
        raise LabelParseError("frame must be a JSON object")
    t = _number(data.get("t"), "t")
    camera = data.get("camera")
    if not isinstance(camera, Mapping):
        raise LabelParseError("camera must be an object")
    pose = _parse_pose(camera.get("pose"))
    intrinsics = _parse_intrinsics(camera.get("intrinsics"))
    raw_objects = data.get("objects")
    if not isinstance(raw_objects, list):
        raise LabelParseError("objects must be a list")
    objects = tuple(_parse_object(item) for item in raw_objects)
    return FrameLabels(t=t, pose=pose, intrinsics=intrinsics, objects=objects)


def normalize_class(cls: str, kind: str | None) -> tuple[str, bool]:
    """Map a label class and kind onto the edge contract.

    Debris and blockades are always ``unknown``. A vehicle label that is
    also tagged debris or blockade is coerced the same way: the hub still
    needs the lane, and the class must not claim a vehicle.
    """
    if kind in ("debris", "blockade") or cls == "unknown":
        return "unknown", True
    if cls == "vehicle" and kind is None:
        return "vehicle", False
    raise LabelParseError(
        f"unsupported class/kind pair class={cls!r} kind={kind!r}"
    )


def _parse_pose(data: Any) -> CameraPose:
    pose = _mapping(data, "camera.pose")
    return CameraPose(
        x=_number(pose.get("x"), "camera.pose.x"),
        y=_number(pose.get("y"), "camera.pose.y"),
        z=_number(pose.get("z"), "camera.pose.z"),
        agl=_number(pose.get("agl"), "camera.pose.agl"),
        yaw=_number(pose.get("yaw"), "camera.pose.yaw"),
        pitch=_number(pose.get("pitch"), "camera.pose.pitch"),
        roll=_number(pose.get("roll"), "camera.pose.roll"),
    )


def _parse_intrinsics(data: Any) -> CameraIntrinsics:
    intr = _mapping(data, "camera.intrinsics")
    width = _int(intr.get("width"), "width")
    height = _int(intr.get("height"), "height")
    if "resolution" in intr and "width" not in intr:
        raise LabelParseError("name resolution width/height as width and height")
    focal = _number(intr.get("focal_length"), "camera.intrinsics.focal_length")
    if focal <= 0:
        raise LabelParseError("focal_length must be positive pixels")
    cx, cy = _principal_point(intr.get("principal_point"))
    fov = intr.get("fov")
    fov_deg = _number(fov, "camera.intrinsics.fov") if fov is not None else _fov_from_focal(focal, height)
    return CameraIntrinsics(
        fov_deg=fov_deg,
        width=width,
        height=height,
        focal_length_px=focal,
        cx=cx,
        cy=cy,
    )


def _parse_object(data: Any) -> ObjectLabel:
    obj = _mapping(data, "object")
    track_id = _track_id(obj.get("track_id"))
    raw_class = obj.get("class")
    if raw_class not in ("vehicle", "unknown"):
        raise LabelParseError(f"object class must be 'vehicle' or 'unknown', got {raw_class!r}")
    kind = obj.get("kind", None)
    if kind not in (None, "debris", "blockade"):
        raise LabelParseError(f"kind must be debris, blockade, or null, got {kind!r}")
    cls, unknown = normalize_class(str(raw_class), kind)
    type_name = obj.get("type")
    if not isinstance(type_name, str) or not type_name:
        raise LabelParseError("type must be a non-empty string")
    lane = obj.get("lane", None)
    if lane is not None and (not isinstance(lane, str) or not lane):
        raise LabelParseError("lane must be a non-empty string or null")
    bbox = _parse_bbox(obj.get("bbox"))
    position = _parse_position(obj.get("position"))
    speed = obj.get("speed", None)
    truth_speed: float | None
    if speed is None:
        if cls == "vehicle":
            raise LabelParseError("vehicle labels require a numeric speed")
        truth_speed = None
    else:
        truth_speed = _number(speed, "speed")
        if truth_speed < 0:
            raise LabelParseError("speed must be >= 0")
    return ObjectLabel(
        track_id=track_id,
        cls=cls,
        unknown=unknown,
        type_name=type_name,
        kind=kind if kind in ("debris", "blockade") else None,
        lane=lane,
        bbox=bbox,
        truth_x=position[0],
        truth_y_up=position[1],
        truth_z=position[2],
        truth_speed=truth_speed,
    )


def _parse_bbox(data: Any) -> BBox:
    if isinstance(data, Mapping):
        values = [data.get("u"), data.get("v"), data.get("w"), data.get("h")]
    elif isinstance(data, (list, tuple)) and len(data) == 4:
        values = list(data)
    else:
        raise LabelParseError("bbox must be [u, v, w, h] or {u, v, w, h}")
    u, v, w, h = (_number(values[i], "bbox") for i in range(4))
    if w <= 0 or h <= 0:
        raise LabelParseError("bbox width and height must be positive")
    return BBox(u=u, v=v, w=w, h=h)


def _parse_position(data: Any) -> tuple[float, float, float]:
    if isinstance(data, Mapping):
        return (
            _number(data.get("x"), "position.x"),
            _number(data.get("y"), "position.y"),
            _number(data.get("z"), "position.z"),
        )
    if isinstance(data, (list, tuple)) and len(data) == 3:
        return (
            _number(data[0], "position.x"),
            _number(data[1], "position.y"),
            _number(data[2], "position.z"),
        )
    raise LabelParseError("position must be {x, y, z} or [x, y, z] with y up")


def _principal_point(data: Any) -> tuple[float, float]:
    if isinstance(data, Mapping):
        return (_number(data.get("cx"), "cx"), _number(data.get("cy"), "cy"))
    if isinstance(data, (list, tuple)) and len(data) == 2:
        return (_number(data[0], "cx"), _number(data[1], "cy"))
    raise LabelParseError("principal_point must be [cx, cy] or {cx, cy}")


def _track_id(value: Any) -> str:
    if isinstance(value, bool) or value is None:
        raise LabelParseError("track_id is required")
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str) and value:
        return value
    raise LabelParseError("track_id must be a string or integer")


def _mapping(data: Any, name: str) -> Mapping[str, Any]:
    if not isinstance(data, Mapping):
        raise LabelParseError(f"{name} must be an object")
    return data


def _number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise LabelParseError(f"{name} must be a number")
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):
        raise LabelParseError(f"{name} must be finite")
    return number


def _int(value: Any, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise LabelParseError(f"{name} must be an integer")
    if value <= 0:
        raise LabelParseError(f"{name} must be positive")
    return value


def _fov_from_focal(focal_px: float, height: int) -> float:
    return math.degrees(2.0 * math.atan((height / 2.0) / focal_px))
