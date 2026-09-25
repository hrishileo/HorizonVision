"""Compare monocular position and tracked speed with label truth."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from horizon_vision.events.pipeline import PipelineResult, ScoredSample


@dataclass(frozen=True, slots=True)
class ErrorStats:
    n: int
    mean: float
    p95: float

    def format(self, unit: str) -> str:
        if self.n == 0:
            return f"n=0 mean=n/a p95=n/a {unit}"
        return (
            f"n={self.n} mean={_fmt(self.mean)} p95={_fmt(self.p95)} {unit}"
        )


@dataclass(frozen=True, slots=True)
class AccuracyReport:
    frames: int
    labels: int
    projected: int
    events: int
    position_m: ErrorStats
    emitted_position_m: ErrorStats
    speed_mps: ErrorStats

    def text(self) -> str:
        return "\n".join(
            [
                "HorizonVision monocular accuracy",
                f"frames: {self.frames}",
                f"labels: {self.labels}",
                f"projected: {self.projected}",
                f"events: {self.events}",
                f"position error (ground plane): {self.position_m.format('m')}",
                f"position error (emitted): {self.emitted_position_m.format('m')}",
                f"speed error (tracked): {self.speed_mps.format('m/s')}",
            ]
        )


def accuracy_report(result: PipelineResult) -> AccuracyReport:
    truth = {(sample.t, sample.track_id): (sample.truth_x, sample.truth_y) for sample in result.samples}
    emitted: list[float] = []
    for event in result.events:
        pair = truth.get((event.t, event.track_id))
        if pair is None:
            continue
        emitted.append(math.hypot(event.x - pair[0], event.y - pair[1]))
    return AccuracyReport(
        frames=result.frames,
        labels=result.labels,
        projected=result.projected,
        events=len(result.events),
        position_m=_stats([_position_error(sample) for sample in result.samples]),
        emitted_position_m=_stats(emitted),
        speed_mps=_stats(
            [
                abs(sample.est_speed - sample.truth_speed)
                for sample in result.samples
                if sample.est_speed is not None and sample.truth_speed is not None
            ]
        ),
    )


def _position_error(sample: ScoredSample) -> float:
    return math.hypot(sample.est_x - sample.truth_x, sample.est_y - sample.truth_y)


def _stats(errors: list[float]) -> ErrorStats:
    if not errors:
        return ErrorStats(n=0, mean=float("nan"), p95=float("nan"))
    arr = np.asarray(errors, dtype=float)
    return ErrorStats(
        n=int(arr.size),
        mean=float(arr.mean()),
        p95=float(np.percentile(arr, 95)),
    )


def _fmt(value: float) -> str:
    if abs(value) < 1e-4:
        return f"{value:.2e}"
    return f"{value:.4f}"
