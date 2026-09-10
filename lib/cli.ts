#!/usr/bin/env bun
import { parseArgs } from "node:util"
import { readFile } from "node:fs/promises"
import { writeUglyTracesReport } from "./write-report"
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o", default: "ugly-traces" },
    help: { type: "boolean", short: "h" },
  },
})
if (values.help)
  console.log("Usage: bun run check:ugly-traces <circuit.json> [-o directory]")
else {
  try {
    if (positionals.length !== 1)
      throw new Error("Expected one Circuit JSON file. Use --help for usage.")
    const circuitJson = JSON.parse(await readFile(positionals[0], "utf8"))
    if (
      !Array.isArray(circuitJson) ||
      circuitJson.some((e) => !e || typeof e.type !== "string")
    )
      throw new Error("Expected a Circuit JSON array")
    const report = await writeUglyTracesReport({
      circuitJson,
      outputDirectory: values.output!,
    })
    console.log(
      `${report.findings.length} ugly trace sections. Report: ${values.output}/report.json`,
    )
    if (report.skippedUnsupportedGeometry)
      console.warn("Analysis skipped: unsupported copper geometry.")
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
