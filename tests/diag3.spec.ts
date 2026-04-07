import { test } from '@playwright/test'

const SAMPLE_GRAPH = JSON.stringify({
  nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
  edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }],
})

test('check event listeners via CDP', async ({ page, context }) => {
  const client = await context.newCDPSession(page)

  await page.goto('/')
  await page.locator('textarea').first().fill(SAMPLE_GRAPH)
  await page.getByRole('button', { name: /load/i }).click()
  await page.locator('#NVL_interactive-wrapper').waitFor({ state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(2500)

  // Get nodeId for #NVL_interactive-wrapper
  const result = await page.evaluate(() => {
    const el = document.getElementById('NVL_interactive-wrapper')
    return el ? true : false
  })
  console.log('wrapper exists:', result)

  // Use CDP to get the element's nodeId  
  const doc = await client.send('DOM.getDocument')
  const node = await client.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#NVL_interactive-wrapper'
  })
  console.log('nodeId:', node.nodeId)

  if (node.nodeId) {
    const listeners = await client.send('DOMDebugger.getEventListeners', {
      objectId: undefined as any,
    }).catch(() => null)

    // Get object id for the element  
    const resolved = await client.send('DOM.resolveNode', { nodeId: node.nodeId })
    const objectId = resolved.object.objectId
    const eventListeners = await client.send('DOMDebugger.getEventListeners', { objectId: objectId! })
    console.log('event listeners on wrapper:', JSON.stringify(
      eventListeners.listeners.map(l => ({ type: l.type, useCapture: l.useCapture })),
      null, 2
    ))
  }

  throw new Error('CDP diagnostic done')
})
