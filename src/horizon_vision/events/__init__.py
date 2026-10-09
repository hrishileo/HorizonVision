"""Camera-only edge events.

Sim records that enter this package are ground-truth labels for scoring.
LiDAR fusion in ``horizon_vision.perception`` is a separate, parked path
and is not used here.
"""

from horizon_vision.events.pipeline import run_label_pipeline
from horizon_vision.events.schema import EdgeEvent

__all__ = ["EdgeEvent", "run_label_pipeline"]
