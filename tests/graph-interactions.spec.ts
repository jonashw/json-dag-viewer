/**
 * Pan and zoom interaction tests for GraphView.
 *
 * NVL exposes zoom state via window.__Nvl_getZoomLevel() which it registers
 * on window in its constructor.  We use Playwright's native mouse/wheel APIs
 * (not synthetic dispatched events) so the browser routes them through its
 * full input pipeline and they reach NVL's event listeners.
 */

import { test, expect, Page } from '@playwright/test'

// ── fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1', label: 'A' }, { id: '2', label: 'B' }, { id: '3', label: 'C' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

// ── helpers ──────────────────────────────────────────────────────────────────

/** Load the app, paste a graph, and wait for NVL to finish layout. */
async function loadGraph(page: Page) {
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  // Wait for the main NVL container to be in the DOM
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  // Allow layout simulation to settle
  await page.waitForTimeout(2000)
}

/** Read the current NVL zoom level via the helper NVL registers on window. */
async function getZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const fn = (window as any).__Nvl_getZoomLevel as ((id?: string) => number) | undefined
    if (!fn) throw new Error('__Nvl_getZoomLevel not on window — NVL not initialised')
    return fn('default')
  })
}

/**
 * Return the centre of the main NVL graph canvas (largest canvas on page,
 * which excludes the small minimap canvas).
 */
async function mainCanvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const boxes = await page.locator('canvas').evaluateAll((els) =>
    els.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, area: r.width * r.height }
    })
  )
  if (!boxes.length) throw new Error('No canvas found')
  const best = boxes.reduce((a, b) => (b.area > a.area ? b : a))
  return { x: best.x, y: best.y }
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('GraphView interactions', () => {

  test('NVL initialises — zoom level is a positive number', async ({ page }) => {
    await loadGraph(page)
    const zoom = await getZoom(page)
    expect(typeof zoom).toBe('number')
    expect(zoom).toBeGreaterThan(0)
    console.log('initial zoom:', zoom)
  })

  test('scroll wheel zooms in  (deltaY < 0 → zoom increases)', async ({ page }) => {
    await loadGraph(page)
    const before = await getZoom(page)
    const { x, y } = await mainCanvasCentre(page)

    await page.mouse.move(x, y)
    await page.mouse.wheel(0, -200)   // negative = scroll up = zoom in
    await page.waitForTimeout(400)

    const after = await getZoom(page)
    console.log(`wheel-in  before=${before}  after=${after}`)
    expect(after).toBeGreaterThan(before)
  })

  test('scroll wheel zooms out (deltaY > 0 → zoom decreases)', async ({ page }) => {
    await loadGraph(page)
    const before = await getZoom(page)
    const { x, y } = await mainCanvasCentre(page)

    await page.mouse.move(x, y)
    await page.mouse.wheel(0, 200)    // positive = scroll down = zoom out
    await page.waitForTimeout(400)

    const after = await getZoom(page)
    console.log(`wheel-out before=${before}  after=${after}`)
    expect(after).toBeLessThan(before)
  })

  test('ctrlKey + wheel simulates pinch-zoom (zoom increases)', async ({ page }) => {
    await loadGraph(page)
    const before = await getZoom(page)
    const { x, y } = await mainCanvasCentre(page)

    // Ctrl+scroll emulates trackpad pinch — NVL treats it the same way
    await page.mouse.move(x, y)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -100)
    await page.keyboard.up('Control')
    await page.waitForTimeout(400)

    const after = await getZoom(page)
    console.log(`pinch     before=${before}  after=${after}`)
    expect(after).toBeGreaterThan(before)
  })

  test('drag pans the canvas — screenshot strip changes', async ({ page }) => {
    await loadGraph(page)
    const { x, y } = await mainCanvasCentre(page)

    // Capture pixel strip before drag
    const clip = { x: x - 200, y: y - 2, width: 400, height: 4 }
    const before = await page.screenshot({ clip })

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 150, y, { steps: 15 })
    await page.mouse.up()
    await page.waitForTimeout(400)

    const after = await page.screenshot({ clip })
    // Pixel content must differ if pan occurred
    expect(Buffer.compare(before, after)).not.toBe(0)
  })

  test('zoom buttons (+/-) change NVL zoom level', async ({ page }) => {
    await loadGraph(page)
    const initial = await getZoom(page)

    await page.getByTitle('Zoom in').click()
    await page.waitForTimeout(400)
    const afterIn = await getZoom(page)
    console.log(`zoom-in   before=${initial}  after=${afterIn}`)
    expect(afterIn).toBeGreaterThan(initial)

    await page.getByTitle('Zoom out').click()
    await page.waitForTimeout(400)
    const afterOut = await getZoom(page)
    console.log(`zoom-out  before=${afterIn}  after=${afterOut}`)
    expect(afterOut).toBeLessThan(afterIn)
  })

})
