import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { detectNon45DegreeSegments } from "../lib/detect-non-45-degree-segments"
import { isOctilinear, segments } from "../lib/geometry"
import { checkUglyTraces } from "../lib/ugly-traces-solver"

const board: AnyCircuitElement = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 20,
  height: 20,
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
      width: 0.1,
      layer: "top",
    })),
  }
}

test("accepts every multiple of 45 degrees in both directions", () => {
  for (let degrees = 0; degrees < 360; degrees += 45) {
    const a = { x: 0, y: 0 },
      b = {
        x: Math.cos((degrees * Math.PI) / 180),
        y: Math.sin((degrees * Math.PI) / 180),
      }
    expect(detectNon45DegreeSegments([a, b])).toEqual([])
    expect(detectNon45DegreeSegments([b, a])).toEqual([])
    expect(
      checkUglyTraces({
        circuitJson: [
          board,
          trace([
            [a.x, a.y],
            [b.x, b.y],
          ]),
        ],
      }).findings,
    ).toEqual([])
  }
})

test("detects non-45 degree directions, including deviations smaller than 3 degrees", () => {
  for (const degrees of [
    2, 30, 44, 46, 60, 91, 135.5, 179, 225.5, 270.5, 359,
  ]) {
    const points = [
      { x: 0, y: 0 },
      {
        x: Math.cos((degrees * Math.PI) / 180),
        y: Math.sin((degrees * Math.PI) / 180),
      },
    ]
    expect(detectNon45DegreeSegments(points)[0].angleDegrees).toBeCloseTo(
      degrees,
      6,
    )
  }
})

test("reports a single oblique segment even when fixing it adds a bend and length", () => {
  const finding = checkUglyTraces({
    circuitJson: [
      board,
      trace([
        [-2, -1],
        [2, 1],
      ]),
    ],
  }).findings[0]
  expect(finding.kind).toBe("strange_angle")
  expect(finding.startRouteIndex).toBe(0)
  expect(finding.endRouteIndex).toBe(1)
  expect(finding.suggested.length).toBe(3)
  expect(finding.lengthSaved).toBeLessThan(0)
  expect(finding.explanation).toContain("Non-45° segment")
  expect(finding.explanation).toContain("Adds")
  expect(segments(finding.suggested).every(isOctilinear)).toBe(true)
})

test("detects short oblique segments and preserves endpoints", () => {
  const original = [
    [0, 0],
    [0.1, 0.05],
  ]
  const finding = checkUglyTraces({ circuitJson: [board, trace(original)] })
    .findings[0]
  expect(finding.kind).toBe("strange_angle")
  expect(finding.suggested[0]).toEqual({ x: 0, y: 0 })
  expect(finding.suggested.at(-1)).toEqual({ x: 0.1, y: 0.05 })
})

test("suppresses oblique segments when both octilinear alternatives are blocked", () => {
  const pad: AnyCircuitElement = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad",
    pcb_component_id: "component",
    shape: "circle",
    radius: 0.1,
    x: 0,
    y: 1,
    layer: "top",
  }
  const result = checkUglyTraces({
    circuitJson: [
      board,
      trace([
        [-2, -1],
        [2, 1],
      ]),
      pad,
      { ...pad, pcb_smtpad_id: "pad2", y: -1 },
    ],
  })
  expect(result.findings).toEqual([])
})

test("ignores zero-length segments and floating-point noise", () => {
  expect(
    detectNon45DegreeSegments([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
  ).toEqual([])
  expect(
    detectNon45DegreeSegments([
      { x: 0, y: 0 },
      { x: 1, y: 1 + 1e-10 },
    ]),
  ).toEqual([])
})
