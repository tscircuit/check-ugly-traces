import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkUglyTraces, UglyTracesSolver } from "../lib/ugly-traces-solver"
import { segmentDistance } from "../lib/geometry"
const board: AnyCircuitElement = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 30,
  height: 30,
  num_layers: 2,
  thickness: 1.6,
  material: "fr4",
}
function trace(points: number[][]): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: points.map(([x, y]) => ({
      route_type: "wire",
      x,
      y,
      width: 0.15,
      layer: "top",
    })),
  }
}
const jitter = () =>
  trace([
    [-4, 0],
    [-3, 0],
    [-2, 1],
    [-1, 1],
    [0, 0],
    [2, 0],
  ])
test("finds removable jitter with a shorter clear replacement", () => {
  const { findings } = checkUglyTraces({ circuitJson: [board, jitter()] })
  expect(findings.length).toBeGreaterThan(0)
  expect(findings[0].lengthSaved).toBeGreaterThan(0.2)
})
test("accepts clean 45-degree routing and straight traces", () => {
  for (const points of [
    [
      [-4, 0],
      [0, 0],
      [4, 0],
    ],
    [
      [-4, 0],
      [-2, 2],
      [2, 2],
    ],
  ])
    expect(
      checkUglyTraces({ circuitJson: [board, trace(points)] }).findings,
    ).toEqual([])
})
test("detects strange angles", () =>
  expect(
    checkUglyTraces({
      circuitJson: [
        board,
        trace([
          [-4, 0],
          [-1, 0.6],
          [2, 0],
        ]),
      ],
    }).findings[0].kind,
  ).toBe("strange_angle"))
test("suppresses crowded sections around a pad", () => {
  const pad: AnyCircuitElement = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad",
    pcb_component_id: "component",
    shape: "rect",
    x: -1,
    y: 0.4,
    width: 8,
    height: 2,
    layer: "top",
  }
  expect(
    checkUglyTraces({ circuitJson: [board, jitter(), pad] }).findings,
  ).toEqual([])
  expect(
    checkUglyTraces({
      circuitJson: [board, jitter(), { ...pad, layer: "bottom" }],
    }).findings.length,
  ).toBeGreaterThan(0)
})
test("rejects replacement blocked by another trace", () => {
  const obstacle = {
    ...trace([
      [-1, -3],
      [-1, 0.1],
    ]),
    pcb_trace_id: "obstacle",
  }
  expect(
    checkUglyTraces({
      circuitJson: [
        board,
        trace([
          [-4, 0],
          [-3, 2],
          [2, 2],
          [3, 0],
        ]),
        obstacle,
      ],
    }).findings,
  ).toEqual([])
})
test("does not join across vias or layer changes", () => {
  const t = trace([
    [-4, 0],
    [-1, 1],
    [2, 0],
  ])
  t.route.splice(1, 0, {
    route_type: "via",
    x: -1,
    y: 1,
    from_layer: "top",
    to_layer: "bottom",
  })
  expect(checkUglyTraces({ circuitJson: [board, t] }).findings).toEqual([])
})
test("does not report outside the board or without board bounds", () => {
  expect(
    checkUglyTraces({
      circuitJson: [{ ...board, width: 1, height: 1 }, jitter()],
    }).findings,
  ).toEqual([])
  expect(checkUglyTraces({ circuitJson: [jitter()] }).findings).toEqual([])
})
test("step and solve agree, input is unchanged, empty solver terminates", () => {
  const input = { circuitJson: [board, jitter()] }
  const before = JSON.stringify(input)
  const solver = new UglyTracesSolver(input)
  while (!solver.solved) solver.step()
  expect(solver.getOutput()).toEqual(checkUglyTraces(input))
  expect(JSON.stringify(input)).toBe(before)
  const empty = new UglyTracesSolver({ circuitJson: [] })
  empty.solve()
  expect(empty.solved).toBe(true)
})
test("segment clearance catches crossings and collinear overlap", () => {
  expect(
    segmentDistance(
      { a: { x: 0, y: 0 }, b: { x: 2, y: 2 } },
      { a: { x: 0, y: 2 }, b: { x: 2, y: 0 } },
    ),
  ).toBe(0)
  expect(
    segmentDistance(
      { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
      { a: { x: 1, y: 0 }, b: { x: 3, y: 0 } },
    ),
  ).toBe(0)
})
test("invalid tuning options are rejected", () => {
  expect(() =>
    checkUglyTraces({ circuitJson: [], options: { clearance: -1 } }),
  ).toThrow()
  expect(() =>
    checkUglyTraces({ circuitJson: [], options: { maxWindowSegments: 1 } }),
  ).toThrow()
})
test("unknown copper geometry is surfaced, not reported as a clean board", () => {
  const pour: AnyCircuitElement = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    covered_with_solder_mask: true,
    layer: "top",
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 5,
    height: 5,
  }
  const result = checkUglyTraces({ circuitJson: [board, jitter(), pour] })
  expect(result.findings).toEqual([])
  expect(result.skippedUnsupportedGeometry).toBe(true)
})
