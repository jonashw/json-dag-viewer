import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('deep diagnostic', async ({ page }) => {
  page.on('console', m => console.log('BROWSER:', m.text()))

  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2500)

  const info = await page.evaluate(() => {
    // 1. Check all relevant elements
    const wrapper = document.getElementById('NVL_interactive-wrapper')
    const zoomControls = document.querySelector('.zoom-controls') as HTMLElement | null
    const canvases = Array.from(document.querySelectorAll('canvas')).map(c => {
      const r = c.getBoundingClientRect()
      return { w: r.width, h: r.height, id: c.id, class: c.className }
    })

    // 2. Check element at center of graph area
    const gv = document.querySelector('.graph-view')
    const gvRect = gv?.getBoundingClientRect()
    const cx = gvRect ? gvRect.x + gvRect.width / 2 : 400
    const cy = gvRect ? gvRect.y + gvRect.height / 2 : 300
    const topEl = document.elementFromPoint(cx, cy)

    // 3. Check zoomControls computed size
    const zcStyle = zoomControls ? getComputedStyle(zoomControls) : null

    // 4. Try to find the React fiber to check nvlRef
    // (Not possible directly, but we can check if setZoom exists via NVL helpers)
    const nvlZoom = (window as any).__Nvl_getZoomLevel?.('default')

    // 5. Check if ZoomInteraction has attached wheel listener by checking
    //    if the wrapper has event listeners (can't directly, but check via other means)
    const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null

    return {
      wrapperFound: !!wrapper,
      wrapperDims: wrapper ? { w: wrapper.offsetWidth, h: wrapper.offsetHeight } : null,
      wrapperStyle: wrapperStyle ? { height: wrapperStyle.height, width: wrapperStyle.width } : null,
      zoomControlsDims: zcStyle ? { height: zcStyle.height, width: zcStyle.width, pointerEvents: zcStyle.pointerEvents } : null,
      canvases,
      elementAtCenter: { tag: topEl?.tagName, id: topEl?.id, class: topEl?.className },
      nvlZoom,
      // 6. Try to call setZoom directly via the NVL window lookup hack
      // NVL stores instances in qf module var, accessible only via window helpers
      // We can't call setZoom from here unless we add a helper.
      // Instead, let's check if the zoom buttons are found
      zoomBtnTitles: Array.from(document.querySelectorAll('[title]')).map(el => (el as HTMLElement).title),
    }
  })

  console.log('=== DIAGNOSTIC ===')
  console.log(JSON.stringify(info, null, 2))

  // Now try clicking zoom in and capture before/after
  const zoomBefore = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  await page.getByTitle('Zoom in').click()
  await page.waitForTimeout(600)
  const zoomAfter = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== ZOOM BUTTON: before=${zoomBefore} after=${zoomAfter} ===`)

  // Add a direct NVL setZoom via page.evaluate to check if NVL itself responds
  // by injecting a helper
  await page.evaluate(() => {
    // Monkey-patch: add __dag_setZoom by reaching into the NVL module qf map
    // We can abuse __Nvl_dumpNodes which returns qf lookup
    // Actually let's just trigger a zoom via keyboard shortcut approach...
    // Or directly try dispatching a wheel event on the wrapper
    const wrapper = document.getElementById('NVL_interactive-wrapper')
    if (wrapper) {
      console.log('dispatching wheel on wrapper')
      wrapper.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaY: -200
      }))
    } else {
      console.log('wrapper not found for wheel dispatch')
    }
  })
  await page.waitForTimeout(400)
  const zoomAfterWheel = await page.evaluate(() => (window as any).__Nvl_getZoomLevel?.('default'))
  console.log(`=== AFTER WHEEL ON WRAPPER: ${zoomAfterWheel} ===`)

  throw new Error('Diagnostic complete — see console output above')
})
