import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('intercept wheel on NVL wrapper', async ({ page }) => {
  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2000)

  // Instrument the wrapper's wheel listener
  const counts = await page.evaluate(() => {
    const wrapper = document.querySelector('#NVL_interactive-wrapper')
    if (!wrapper) return 'no wrapper'
    let count = 0
    wrapper.addEventListener('wheel', (e) => {
      count++
      console.log(`[test-listener] wheel event count=${count} deltaY=${e.deltaY} target=${(e.target as HTMLElement)?.tagName} id=${(e.target as HTMLElement)?.id}`)
    }, { passive: true })
    ;(window as any).__testWheelCount = () => count
    return 'instrumented'
  })
  console.log('Instrumentation:', counts)

  // Get the NVL wrapper bounding box directly
  const wrapperBox = await page.locator('#NVL_interactive-wrapper').boundingBox()
  if (!wrapperBox) throw new Error('No wrapper bbox')
  const cx = wrapperBox.x + wrapperBox.width / 2
  const cy = wrapperBox.y + wrapperBox.height / 2
  console.log(`Firing wheel at (${cx.toFixed(0)}, ${cy.toFixed(0)}) on #NVL_interactive-wrapper`)

  const before = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  const wheelCount = await page.evaluate(() => (window as any).__testWheelCount?.() ?? 0)
  
  console.log(`zoom: ${before} -> ${after}  |  wheel events received: ${wheelCount}`)

  throw new Error('diagnostic done')
})
