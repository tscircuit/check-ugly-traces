import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { AnyCircuitElement } from "circuit-json"
import { UglyTracesSolver } from "lib/ugly-traces-solver"
import board04 from "tests/fixtures/f1c100s-v0.4.json"
import board05 from "tests/fixtures/f1c100s-v0.5.json"
export default {
  "F1C100s v0.4": (
    <GenericSolverDebugger
      createSolver={() =>
        new UglyTracesSolver({ circuitJson: board04 as AnyCircuitElement[] })
      }
    />
  ),
  "F1C100s v0.5": (
    <GenericSolverDebugger
      createSolver={() =>
        new UglyTracesSolver({ circuitJson: board05 as AnyCircuitElement[] })
      }
    />
  ),
}
