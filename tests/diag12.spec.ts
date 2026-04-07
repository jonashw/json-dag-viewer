import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('track onLayoutDone calls and zoom over time', async ({ page }) => {
  let layoutDoneCount = 0
  page.on('console', m => {
    const text = m.text()
    if (!text.includes('WebGL') && !text.includes('DevTools') && !text.includes('Download')) {
      if (text.includes('layout done')) layoutDoneCount++
      console.log(`t=${Date.now()} BROWSER: ${text}`)
    }
  })
  
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  
  // Poll zoom every 200ms for 3 seconds to see if it's still changing
  const zoomHistory: { t: number; z: number }[] = []
  for (let i = 0; i < 15; i++) {
    const z = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default') ?? -1)
    zoomHistory.push({ t: i * 200, z })
    await page.waitForTimeout(200)
  }
  console.log('=== Zoom history (every 200ms) ===')
  zoomHistory.forEach(h => console.log(`  t=${h.t}ms  zoom=${h.z.toFixed(4)}`))
  console.log(`=== Total onLayoutDone calls: ${layoutDoneCount} ===`)

  // Now fire wheel
  const wrapperBox = await page.locator('#NVL_interactive-wrapper').boundingBox()
  if (!wrapperBox) throw new Error('no wrapper')
  const cx = wrapperBox.x + wrapperBox.width / 2
  const cy = wrapperBox.y + wrapperBox.height / 2
  const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== Wheel at (#NVL_interactive-wrapper center): zoom ${before} -> ${after} ===`)
  console.log(`=== Final onLayoutDone count: ${layoutDoneCount} ===`)
  
  throw new Error('diagnostic done')
})
