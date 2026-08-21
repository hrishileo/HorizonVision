import { describe, expect, it } from "vitest";
import {
  CELL_UNKNOWN,
  cellObjectIds,
  cellState,
  detectionsFromGrid,
  rasterizeSweep,
  worldToCell,
} from "../src/sim/occupancyGrid";
import type { SceneObject } from "../src/sim/types";

const tiny = {
  cellSize: 1,
  xMin: 0,
  xMax: 4,
  yMin: -2,
  yMax: 2,
  groundHeight: 0.15,
  minOccupied: 1,
  sweepLateral: 20,
};

function car(partial: Partial<SceneObject> & Pick<SceneObject, "id" | "center" | "size">): SceneObject {
  return {
    label: "car",
    yaw: 0,
    color: "#5b7c99",
    ...partial,
  };
}

describe("BEV occupancy grid", () => {
  it("empty sweep stays unknown", () => {
    const grid = rasterizeSweep(new Float32Array(0), new Int32Array(0), 0, [], tiny);
    expect(grid.occupied).toHaveLength(0);
    expect(grid.free).toHaveLength(0);
    expect(grid.states.every((s) => s === CELL_UNKNOWN)).toBe(true);
  });

  it("ground-only returns mark a cell free", () => {
    const pts = new Float32Array([0.5, 0.02, 0]);
    const grid = rasterizeSweep(pts, new Int32Array([0]), 0, [], tiny);
    const cell = worldToCell(0.5, 0, 0, grid.config)!;
    expect(cellState(grid, cell.ix, cell.iy)).toBe("free");
    expect(grid.occupied).toHaveLength(0);
  });

  it("elevated points in a cell mark it occupied", () => {
    const pts = new Float32Array([0.5, 0.6, 0]);
    const grid = rasterizeSweep(pts, new Int32Array([0]), 0, [], tiny);
    const cell = worldToCell(0.5, 0, 0, grid.config)!;
    expect(cellState(grid, cell.ix, cell.iy)).toBe("occupied");
    expect(grid.free).toHaveLength(0);
  });

  it("an object spanning two cells occupies and attributes both", () => {
    const obj = car({ id: 7, center: [1, 0, 0], size: [2.2, 1.2, 1.4] });
    const pts = new Float32Array([0.4, 0.5, 0, 1.6, 0.5, 0]);
    const grid = rasterizeSweep(pts, new Int32Array([7, 7]), 0, [obj], tiny);
    const a = worldToCell(0.4, 0, 0, grid.config)!;
    const b = worldToCell(1.6, 0, 0, grid.config)!;
    expect(a.ix).not.toBe(b.ix);
    expect(cellState(grid, a.ix, a.iy)).toBe("occupied");
    expect(cellState(grid, b.ix, b.iy)).toBe("occupied");
    expect(cellObjectIds(grid, a.ix, a.iy)).toContain(7);
    expect(cellObjectIds(grid, b.ix, b.iy)).toContain(7);
    expect(grid.blobs.some((blob) => blob.objectIds.includes(7) && blob.cells.length >= 2)).toBe(
      true,
    );
    const dets = detectionsFromGrid(grid, [obj], 0);
    expect(dets).toHaveLength(1);
    expect(dets[0]?.id).toBe(7);
  });

  it("attributes from points, not from whether the object center sits in a cell", () => {
    const obj = car({ id: 3, center: [0.4, 0, 0], size: [0.4, 0.4, 1] });
    const pts = new Float32Array([1.5, 0.5, 0]);
    const grid = rasterizeSweep(pts, new Int32Array([3]), 0, [obj], tiny);
    const centerCell = worldToCell(0.4, 0, 0, grid.config)!;
    const pointCell = worldToCell(1.5, 0, 0, grid.config)!;
    expect(centerCell.ix).not.toBe(pointCell.ix);
    expect(cellState(grid, centerCell.ix, centerCell.iy)).not.toBe("occupied");
    expect(cellState(grid, pointCell.ix, pointCell.iy)).toBe("occupied");
    expect(cellObjectIds(grid, pointCell.ix, pointCell.iy)).toContain(3);
  });
});
