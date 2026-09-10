import type { AnyCircuitElement, LayerRef } from "circuit-json"
import type { Point } from "./geometry"
export type CheckOptions = {
  clearance?: number
  minLengthSaved?: number
  maxWindowSegments?: number
}
export type CheckInput = {
  circuitJson: AnyCircuitElement[]
  options?: CheckOptions
}
export type UglyTraceFinding = {
  id: string
  pcb_trace_id: string
  layer: LayerRef
  startRouteIndex: number
  endRouteIndex: number
  kind: "strange_angle" | "unnecessary_jitter"
  explanation: string
  original: Point[]
  suggested: Point[]
  width: number
  lengthSaved: number
  clearance: number
}
