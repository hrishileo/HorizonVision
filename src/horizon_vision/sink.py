"""
Stub sink for timestamp-synced samples.

Records that a fused frame is ready. Does not invent traffic or
reroute events — those are later work.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from horizon_vision.perception.edge_ai import PerceptionOutput
from horizon_vision.perception.fusion import FusedFrame


class SyncedSampleSink:
    """In-memory log of synced frames. Ready to swap for a stream later."""

    def __init__(self) -> None:
        self.ready: List[Dict[str, Any]] = []

    def record(
        self,
        fused: FusedFrame,
        perception: Optional[PerceptionOutput] = None,
    ) -> Dict[str, Any]:
        detections = perception.detections if perception is not None else fused.detections
        entry: Dict[str, Any] = {
            "synced": True,
            "timestamp": fused.timestamp,
            "sensor_x": fused.sensor_x,
            "num_lidar_points": (
                fused.point_cloud.num_points if fused.point_cloud is not None else 0
            ),
            "num_detections": len(detections),
            "detections": [
                {
                    "id": getattr(d, "object_id", None),
                    "label": d.label,
                    "confidence": float(d.confidence),
                    "center": d.center.tolist(),
                    "distance": getattr(d, "distance", None),
                }
                for d in detections
            ],
        }
        self.ready.append(entry)
        return entry
