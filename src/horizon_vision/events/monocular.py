"""Monocular ground-plane position from a pixel box and camera pose.

The box's ground-contact pixel (bottom center) is cast as a ray and
intersected with the plane ``agl`` metres below the camera. Speed is not
computed here; the tracker derives it from successive positions.

Camera model (OpenCV axes in a Mag Mile world):

- World ``+X`` east, ``+Y`` up, ``+Z`` south. Ground is flat.
- Yaw ``0`` looks south. Positive yaw turns toward east (about ``+Y``).
- Pitch ``0`` is level. Positive pitch is nose up. ``-pi/2`` looks straight down.
- Roll positive is right-wing down.
- Image ``+u`` is camera right, ``+v`` is camera down, optical axis is ``+Z``.

Event ``x, y`` are east and south of that intersection (world ``X`` and ``Z``).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from horizon_vision.events.labels import BBox, CameraIntrinsics, CameraPose

_RAY_EPS = 1e-9


@dataclass(frozen=True, slots=True)
class GroundEstimate:
    x: float
    y: float
    confidence: float


def world_from_camera(yaw: float, pitch: float, roll: float) -> np.ndarray:
    """Columns are the camera +X, +Y, +Z axes expressed in the world frame."""
    forward_h = np.array([math.sin(yaw), 0.0, math.cos(yaw)], dtype=float)
    up = np.array([0.0, 1.0, 0.0], dtype=float)
    right = np.cross(forward_h, up)
    forward = math.cos(pitch) * forward_h + math.sin(pitch) * up
    down = np.cross(forward, right)
    cr, sr = math.cos(roll), math.sin(roll)
    right_r = cr * right + sr * down
    down_r = -sr * right + cr * down
    return np.column_stack((right_r, down_r, forward))


def estimate_ground_point(
    bbox: BBox,
    pose: CameraPose,
    intrinsics: CameraIntrinsics,
) -> GroundEstimate | None:
    """Intersect the box's ground-contact ray with the plane under the camera.

    Returns ``None`` when the ray misses the ground in front of the camera
    (level or upward look, or the camera is not above the plane).
    """
    if pose.agl <= 0 or intrinsics.focal_length_px <= 0:
        return None
    u, v = bbox.ground_contact
    direction_cam = np.array(
        [
            (u - intrinsics.cx) / intrinsics.focal_length_px,
            (v - intrinsics.cy) / intrinsics.focal_length_px,
            1.0,
        ],
        dtype=float,
    )
    direction = world_from_camera(pose.yaw, pose.pitch, pose.roll) @ direction_cam
    if abs(direction[1]) < _RAY_EPS:
        return None
    ground_y = pose.y - pose.agl
    scale = (ground_y - pose.y) / direction[1]
    if scale <= 0:
        return None
    point = np.array([pose.x, pose.y, pose.z], dtype=float) + scale * direction
    norm = float(np.linalg.norm(direction))
    if norm < _RAY_EPS:
        return None
    # Straight down is confident. A grazing ray is not.
    confidence = float(np.clip(abs(direction[1]) / norm, 0.0, 1.0))
    return GroundEstimate(x=float(point[0]), y=float(point[2]), confidence=confidence)
