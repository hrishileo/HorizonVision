"""Turn per-frame labels into tracked events.

Position on the wire comes from the monocular ground-plane estimate.
The label's true position and speed stay on the scored sample for the
accuracy check. They are not copied onto the event.
"""

from __future__ import annotations

from dataclasses import dataclass

from horizon_vision.events.labels import FrameLabels
from horizon_vision.events.monocular import estimate_ground_point
from horizon_vision.events.schema import EdgeEvent
from horizon_vision.events.tracking import Observation, TrackBook


@dataclass(frozen=True, slots=True)
class ScoredSample:
    """One labeled object that produced a ground-plane estimate."""

    t: float
    track_id: str
    est_x: float
    est_y: float
    est_speed: float | None
    truth_x: float
    truth_y: float
    truth_speed: float | None
    projected: bool = True


@dataclass(frozen=True, slots=True)
class PipelineResult:
    events: list[EdgeEvent]
    samples: list[ScoredSample]
    frames: int
    labels: int
    projected: int


def run_label_pipeline(
    frames: list[FrameLabels],
    book: TrackBook | None = None,
) -> PipelineResult:
    tracker = book if book is not None else TrackBook()
    events: list[EdgeEvent] = []
    samples: list[ScoredSample] = []
    label_count = 0
    projected = 0

    for frame in frames:
        observations: list[Observation] = []
        pending: list[tuple[str, float, float, float, float, float | None]] = []
        for obj in frame.objects:
            label_count += 1
            estimate = estimate_ground_point(obj.bbox, frame.pose, frame.intrinsics)
            if estimate is None:
                continue
            projected += 1
            observations.append(
                Observation(
                    track_id=obj.track_id,
                    x=estimate.x,
                    y=estimate.y,
                    cls=obj.cls,
                    unknown=obj.unknown,
                    lane=obj.lane,
                    confidence=estimate.confidence,
                )
            )
            truth_x, truth_y = obj.truth_ground
            pending.append(
                (
                    obj.track_id,
                    estimate.x,
                    estimate.y,
                    truth_x,
                    truth_y,
                    obj.truth_speed,
                )
            )

        events.extend(tracker.update(frame.t, observations))
        for track_id, est_x, est_y, truth_x, truth_y, truth_speed in pending:
            samples.append(
                ScoredSample(
                    t=frame.t,
                    track_id=track_id,
                    est_x=est_x,
                    est_y=est_y,
                    est_speed=tracker.speed_of(track_id),
                    truth_x=truth_x,
                    truth_y=truth_y,
                    truth_speed=0.0 if truth_speed is None else truth_speed,
                )
            )

    return PipelineResult(
        events=events,
        samples=samples,
        frames=len(frames),
        labels=label_count,
        projected=projected,
    )
