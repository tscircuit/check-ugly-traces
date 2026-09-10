import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Resvg } from "@resvg/resvg-js"
import type { AnyCircuitElement } from "circuit-json"
import { checkUglyTraces } from "../lib/ugly-traces-solver"
import { renderUglyTraceFinding } from "../lib/render-finding"
for (const version of ["0.4", "0.5"])
  test(`real F1C100s ${version} findings and visual snapshots`, async () => {
    const circuitJson: AnyCircuitElement[] = await Bun.file(
      `${import.meta.dir}/fixtures/f1c100s-v${version}.json`,
    ).json()
    const result = checkUglyTraces({ circuitJson })
    expect(result.skippedUnsupportedGeometry).toBe(false)
    expect(
      result.findings.map((f) => ({ id: f.id, kind: f.kind })),
    ).toMatchSnapshot()
    const images = result.findings.map((f) => ({
      name: f.id,
      svg: renderUglyTraceFinding(circuitJson, f),
    }))
    images.push({
      name: "overview",
      svg: convertCircuitJsonToPcbSvg(circuitJson, {
        width: 960,
        height: 960,
        includeVersion: false,
        shouldDrawErrors: false,
      }),
    })
    for (const { name, svg } of images) {
      const stem = `${import.meta.dir}/__snapshots__/f1c100s-v${version}-${name}`
      if (process.env.UPDATE_SNAPSHOTS === "1") {
        await Bun.write(`${stem}.svg`, svg)
        await Bun.write(`${stem}.png`, new Resvg(svg).render().asPng())
      }
      expect(svg).toBe(await Bun.file(`${stem}.svg`).text())
      expect(new Resvg(svg).render().asPng().length).toBeGreaterThan(1000)
    }
  }, 30_000)
