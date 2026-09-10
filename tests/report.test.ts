import { expect, test } from "bun:test"
import { mkdtemp, rm, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeUglyTracesReport } from "../lib/write-report"
test("writes a real-board SVG for every finding and an indexed JSON report", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "ugly-report-"))
  try {
    const circuitJson = await Bun.file(
      `${import.meta.dir}/fixtures/f1c100s-v0.4.json`,
    ).json()
    const report = await writeUglyTracesReport({ circuitJson, outputDirectory })
    const saved = await Bun.file(join(outputDirectory, "report.json")).json()
    expect(saved.images.length).toBe(report.findings.length)
    expect(saved.images.length).toBeGreaterThan(0)
    for (const image of saved.images) {
      const svg = await Bun.file(join(outputDirectory, image.filename)).text()
      expect(svg.includes('viewBox="0 0 960 690"')).toBe(true)
      expect(svg).toContain("Clear alternative")
      expect(svg).toContain("stroke-dasharray")
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true })
  }
}, 30_000)
test("CLI gives help and rejects malformed input", async () => {
  const cli = join(import.meta.dir, "../lib/cli.ts")
  const help = Bun.spawnSync([process.execPath, cli, "--help"])
  expect(help.exitCode).toBe(0)
  expect(help.stdout.toString()).toContain("circuit.json")
  const missing = Bun.spawnSync([process.execPath, cli])
  expect(missing.exitCode).toBe(1)
})
