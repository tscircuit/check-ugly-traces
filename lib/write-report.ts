import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { checkUglyTraces } from "./ugly-traces-solver"
import { renderUglyTraceFinding } from "./render-finding"
import type { CheckInput } from "./types"
export async function writeUglyTracesReport(
  input: CheckInput & { outputDirectory: string },
) {
  const report = checkUglyTraces(input)
  await mkdir(input.outputDirectory, { recursive: true })
  const images = []
  for (const [index, finding] of report.findings.entries()) {
    const filename = `ugly-trace-${String(index + 1).padStart(3, "0")}.svg`
    await writeFile(
      join(input.outputDirectory, filename),
      renderUglyTraceFinding(input.circuitJson, finding),
    )
    images.push({ findingId: finding.id, filename })
  }
  await writeFile(
    join(input.outputDirectory, "report.json"),
    JSON.stringify({ ...report, images }, null, 2),
  )
  return report
}
