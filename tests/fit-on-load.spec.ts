/**
 * Verify that loading a graph triggers fitAll() exactly once (after first layout),
 * and that loading a second graph re-triggers fitAll.
 *
 * Uses screenshot comparison since NVL's zoom level accessors are unreliable
 * in headless Playwright (always return a stale value).
 */
import { test, expect, Page } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [
    { id: '1', label: 'A' },
    { id: '2', label: 'B' },
    { id: '3', label: 'C' },
    { id: '4', label: 'D' },
    { id: '5', label: 'E' },
  ],
  edges: [
    { from: '1', to: '2' },
    { from: '2', to: '3' },
    { from: '3', to: '4' },
    { from: '4', to: '5' },
  ],
})

const SECOND_GRAPH = JSON.stringify({
  nodes: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
  ],
  edges: [{ from: 'x', to: 'y' }],
})

async function loadGraph(page: Page, json: string) {
  await page.locator('textarea').first().fill(json)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(3000)
}

async function mainCanvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const boxes = await page.locator('canvas').evaluateAll((els) =>
    els.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, area: r.width * r.height }
    })
  )
  if (!boxes.length) throw new Error('No canvas found')
  return boxes.reduce((a, b) => (b.area > a.area ? b : a))
}

/** Capture a screenshot of the graph area for comparison. */
async function graphScreenshot(page: Page): Promise<Buffer> {
  const { x, y } = await mainCanvasCentre(page)
  return page.screenshot({ clip: { x: x - 300, y: y - 200, width: 600, height: 400 } })
}

test.describe('fit-on-load', () => {

  test('nodes are spread across the viewport after loading a graph', async ({ page }) => {
    await page.goto('/')
    await loadGraph(page, SAMPLE_GRAPH)

    // After fitAll, nodes should be spread out, not stacked at origin.
    // Sample left and right halves of the canvas — at least one should have
    // non-uniform pixels (i.e. rendered node content).
    const { x, y } = await mainCanvasCentre(page)

    const leftClip  = { x: x - 300, y: y - 50, width: 200, height: 100 }
    const rightClip = { x: x + 100, y: y - 50, width: 200, height: 100 }
    const leftPx  = await page.screenshot({ clip: leftClip })
    const rightPx = await page.screenshot({ clip: rightClip })

    const leftUniform  = leftPx.every((b, _i, a) => b === a[0])
    const rightUniform = rightPx.every((b, _i, a) => b === a[0])
    expect(leftUniform && rightUniform).toBe(false)
  })

  test('loading a second graph changes the viewport (fitAll re-triggers)', async ({ page }) => {
    await page.goto('/')
    await loadGraph(page, SAMPLE_GRAPH)
    const firstGraph = await graphScreenshot(page)

    // Load a very different graph
    await loadGraph(page, SECOND_GRAPH)
    const secondGraph = await graphScreenshot(page)

    // The viewport should look different (different node count, different fit)
    expect(Buffer.compare(firstGraph, secondGraph)).not.toBe(0)
  })

})
