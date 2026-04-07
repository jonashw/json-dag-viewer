import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('canvas sizing diagnostic', async ({ page }) => {
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2000)

  // List all canvases
  const canvases = await page.locator('canvas').evaluateAll((els) =>
    els.map((c) => {
      const r = c.getBoundingClientRect()
      const center = { x: r.x + r.width/2, y: r.y + r.height/2 }
      const topEl = document.elementFromPoint(center.x, center.y)
      return `${r.width.toFixed(0)}x${r.height.toFixed(0)} @ (${center.x.toFixed(0)},${center.y.toFixed(0)}) topEl: ${topEl?.tagName} id="${topEl?.id}" class="${topEl?.className}"`
    })
  )
  console.log('=== All canvases ===\n' + canvases.join('\n'))

  // Using Playwright locator boundingBox (returns page coords without ViewPort transformation issues)
  const allBoxes = await page.locator('canvas').all()
  for (const c of allBoxes) {
    const bb = await c.boundingBox()
    if (!bb) continue
    const cx = bb.x + bb.width/2
    const cy = bb.y + bb.height/2
    console.log(`Canvas bbox: ${bb.width.toFixed(0)}x${bb.height.toFixed(0)} center=(${cx.toFixed(0)},${cy.toFixed(0)})`)
    const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(500)
    const after = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
    console.log(`  wheel result: ${before} -> ${after}`)
    // reload page for next iteration
  }

  throw new Error('diagnostic done')
})
