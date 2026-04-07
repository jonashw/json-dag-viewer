import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('timing of onLayoutDone relative to mouse.wheel', async ({ page }) => {
  const layoutLog: { time: number }[] = []
  
  page.on('console', m => {
    const text = m.text()
    if (!text.includes('WebGL') && !text.includes('React DevTools') && !text.includes('Download')) {
      console.log(`t=${Date.now()} BROWSER: ${text}`)
    }
    if (text.includes('layout done')) layoutLog.push({ time: Date.now() })
  })

  const t0 = Date.now()
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  console.log(`=== #NVL_interactive-wrapper attached at +${Date.now() - t0}ms ===`)
  await page.waitForTimeout(2000)
  console.log(`=== after 2000ms wait at +${Date.now() - t0}ms, layoutDone count: ${layoutLog.length} ===`)

  // Get canvas center
  const boxes = await page.locator('canvas').evaluateAll((els) =>
    els.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.x + r.width/2, y: r.y + r.height/2, area: r.width * r.height }
    })
  )
  console.log(`=== Canvas count: ${boxes.length} ===`)
  if (boxes.length === 0) { throw new Error('No canvas'); }
  const best = boxes.reduce((a, b) => b.area > a.area ? b : a)
  
  const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== Before wheel: zoom=${before} ===`)
  
  await page.mouse.move(best.x, best.y)
  await page.mouse.wheel(0, -300)
  const immediate = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== Immediately after wheel: zoom=${immediate} ===`)
  await page.waitForTimeout(100)
  const after100 = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== 100ms after wheel: zoom=${after100} ===`)
  await page.waitForTimeout(300)
  const after400 = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== 400ms after wheel: zoom=${after400} ===`)

  throw new Error('Diagnostic done — see above')
})
