import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImageViewer from '../src/ImageViewer.vue'
import type { ImageViewerExposed, ImageViewerProps } from '../src/types'

// jsdom has no layout: give every element a fixed client size (the frame size).
let frameW = 1000
let frameH = 800
const proto = Element.prototype
const origW = Object.getOwnPropertyDescriptor(proto, 'clientWidth')!
const origH = Object.getOwnPropertyDescriptor(proto, 'clientHeight')!

beforeEach(() => {
  frameW = 1000
  frameH = 800
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => frameW })
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => frameH })
})

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  Object.defineProperty(proto, 'clientWidth', origW)
  Object.defineProperty(proto, 'clientHeight', origH)
})

function mountViewer(props: ImageViewerProps = {}) {
  wrapper = mount(ImageViewer, { props, attachTo: document.body })
  return wrapper
}

async function loadImage(w = 4000, h = 2000, props: ImageViewerProps = {}) {
  const wr = mountViewer({ src: 'file:///pics/%D0%A4%D0%BE%D1%82%D0%BE%201.png', ...props })
  const img = wr.find('img').element as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: w })
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: h })
  await wr.find('img').trigger('load')
  return wr
}

const imgStyle = (wr: VueWrapper) => (wr.find('img').element as HTMLImageElement).style.transform
const zoomText = (wr: VueWrapper) => wr.find('.viv-info-zoom').text()
const btn = (wr: VueWrapper, action: string) => wr.find(`[data-action="${action}"]`)
// Real event objects: test-utils can't set clientX/button on synthetic ones.
async function fire(el: Element, type: string, init: PointerEventInit & WheelEventInit = {}) {
  const opts = { bubbles: true, cancelable: true, ...init }
  let ev: Event
  if (type === 'wheel') ev = new WheelEvent(type, opts)
  else if (type.startsWith('pointer') && typeof PointerEvent !== 'undefined') ev = new PointerEvent(type, opts)
  else {
    ev = new MouseEvent(type, opts)
    if (init.pointerId !== undefined) Object.defineProperty(ev, 'pointerId', { value: init.pointerId })
  }
  el.dispatchEvent(ev)
  await nextTick()
}
const api = (wr: VueWrapper) => wr.vm as unknown as ImageViewerExposed

describe('ImageViewer', () => {
  test('without src shows the "No image" message and disables the toolbar', () => {
    const wr = mountViewer()
    expect(wr.find('.viv-message').text()).toContain('No image')
    expect(wr.find('img').exists()).toBe(false)
    for (const a of ['zoom-in', 'zoom-out', 'fit', 'actual']) {
      expect(btn(wr, a).attributes('disabled')).toBeDefined()
    }
  })

  test('image is hidden until loaded, then fitted and centered', async () => {
    const wr = mountViewer({ src: 'a.png' })
    expect((wr.find('img').element as HTMLElement).style.display).toBe('none')
    wr.unmount()

    const w2 = await loadImage()
    expect((w2.find('img').element as HTMLElement).style.display).toBe('')
    expect(imgStyle(w2)).toBe('translate(0px, 150px) scale(0.25)')
    expect(w2.find('.viv-info-name').text()).toBe('Фото 1.png')
    expect(w2.find('.viv-info-dims').text()).toBe('4000 × 2000')
    expect(zoomText(w2)).toBe('25%')
    expect(btn(w2, 'fit').attributes('aria-pressed')).toBe('true')
    expect(btn(w2, 'actual').attributes('aria-pressed')).toBe('false')
    expect(w2.emitted('load')![0][0]).toMatchObject({ width: 4000, height: 2000, intrinsicSize: true })
  })

  test('name prop overrides the file name', async () => {
    const wr = await loadImage(10, 10, { name: 'Custom' })
    expect(wr.find('.viv-info-name').text()).toBe('Custom')
  })

  test('small images are enlarged to fit', async () => {
    const wr = await loadImage(100, 50)
    expect(imgStyle(wr)).toBe('translate(0px, 150px) scale(10)')
    expect(wr.find('img').classes()).toContain('viv-pixelated')
  })

  test('keys: + zooms in, 1 is 100%, a fits again', async () => {
    const wr = await loadImage()
    await wr.trigger('keydown', { key: '+' })
    expect(zoomText(wr)).toBe('31%')
    expect(btn(wr, 'fit').attributes('aria-pressed')).toBe('false')

    await wr.trigger('keydown', { key: '1' })
    expect(imgStyle(wr)).toBe('translate(-1500px, -600px) scale(1)')
    expect(btn(wr, 'actual').attributes('aria-pressed')).toBe('true')

    await wr.trigger('keydown', { key: 'a' })
    expect(imgStyle(wr)).toBe('translate(0px, 150px) scale(0.25)')
  })

  test('keys: - zooms out, arrows pan (Shift = bigger step)', async () => {
    const wr = await loadImage()
    await wr.trigger('keydown', { key: '-' })
    expect(api(wr).getView().scale).toBeCloseTo(0.2)

    const v0 = api(wr).getView()
    await wr.trigger('keydown', { key: 'ArrowRight' })
    expect(api(wr).getView().x).toBeCloseTo(v0.x - 100)
    await wr.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect(api(wr).getView().y).toBeCloseTo(v0.y + 320)
  })

  test('keys with Ctrl/Alt/Meta are left to the browser', async () => {
    const wr = await loadImage()
    await wr.trigger('keydown', { key: '+', ctrlKey: true })
    expect(zoomText(wr)).toBe('25%')
  })

  test('keyboard="focus" ignores window keys; "global" uses them but not in inputs', async () => {
    const wr = await loadImage()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
    await nextTick()
    expect(zoomText(wr)).toBe('25%')

    await wr.setProps({ keyboard: 'global' })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
    await nextTick()
    expect(zoomText(wr)).toBe('31%')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))
    await nextTick()
    expect(zoomText(wr)).toBe('31%')
    input.remove()
  })

  test('toolbar buttons', async () => {
    const wr = await loadImage()
    await btn(wr, 'zoom-in').trigger('click')
    expect(api(wr).getView().scale).toBeCloseTo(0.3125)
    await btn(wr, 'zoom-out').trigger('click')
    expect(api(wr).getView().scale).toBeCloseTo(0.25)
    await btn(wr, 'actual').trigger('click')
    expect(api(wr).getView().scale).toBe(1)
    await btn(wr, 'fit').trigger('click')
    expect(api(wr).getView()).toEqual({ scale: 0.25, x: 0, y: 150, fitMode: true })
  })

  test('zoom buttons are disabled at the limits', async () => {
    const wr = await loadImage(100, 100, { maxScale: 10 })
    api(wr).zoomTo(1000)
    await nextTick()
    expect(api(wr).getView().scale).toBe(10)
    expect(btn(wr, 'zoom-in').attributes('disabled')).toBeDefined()
    expect(btn(wr, 'zoom-out').attributes('disabled')).toBeUndefined()
  })

  test('wheel zooms keeping the point under the cursor', async () => {
    const wr = await loadImage()
    const v0 = api(wr).getView()
    const cx = 300, cy = 200
    const before = [(cx - v0.x) / v0.scale, (cy - v0.y) / v0.scale]
    await fire(wr.find('.viv-frame').element, 'wheel', { deltaY: -100, clientX: cx, clientY: cy })
    const v1 = api(wr).getView()
    expect(v1.scale).toBeGreaterThan(v0.scale)
    expect((cx - v1.x) / v1.scale).toBeCloseTo(before[0])
    expect((cy - v1.y) / v1.scale).toBeCloseTo(before[1])
  })

  test('left drag pans', async () => {
    const wr = await loadImage()
    const f = wr.find('.viv-frame')
    await fire(f.element, 'pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 10 })
    expect(f.classes()).toContain('viv-panning')
    await fire(f.element, 'pointermove', { pointerId: 1, clientX: 60, clientY: 30 })
    await fire(f.element, 'pointermove', { pointerId: 1, clientX: 70, clientY: 40 })
    await fire(f.element, 'pointerup', { pointerId: 1 })
    expect(f.classes()).not.toContain('viv-panning')
    expect(api(wr).getView()).toEqual({ scale: 0.25, x: 60, y: 180, fitMode: false })
    await fire(f.element, 'pointermove', { pointerId: 1, clientX: 500, clientY: 500 })
    expect(api(wr).getView().x).toBe(60)
  })

  test('middle click fits', async () => {
    const wr = await loadImage()
    api(wr).zoom100()
    await fire(wr.find('.viv-frame').element, 'auxclick', { button: 1 })
    expect(api(wr).getView().fitMode).toBe(true)
    expect(api(wr).getView().scale).toBe(0.25)
  })

  test('resize re-fits in fit mode, recenters after zooming', async () => {
    const wr = await loadImage()
    frameW = 2000; frameH = 1600
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(api(wr).getView()).toEqual({ scale: 0.5, x: 0, y: 300, fitMode: true })

    api(wr).zoom100()
    const v0 = api(wr).getView()
    frameW = 1000; frameH = 800
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(api(wr).getView()).toEqual({ scale: 1, x: v0.x - 500, y: v0.y - 400, fitMode: false })
  })

  test('image without intrinsic size uses fallbackSize', async () => {
    const wr = await loadImage(0, 0)
    expect(wr.find('.viv-info-dims').text()).toBe('no intrinsic size')
    expect(api(wr).getView().scale).toBe(0.8)
  })

  test('load error shows a message and emits error', async () => {
    const wr = mountViewer({ src: 'missing.png' })
    await wr.find('img').trigger('error')
    expect(wr.find('.viv-message').text()).toContain('Cannot load image')
    expect(wr.find('.viv-message').text()).toContain('missing.png')
    expect(wr.emitted('error')![0]).toEqual(['missing.png'])
    expect(btn(wr, 'fit').attributes('disabled')).toBeDefined()
  })

  test('changing src resets to loading and fits the new image', async () => {
    const wr = await loadImage()
    api(wr).zoom100()
    await wr.setProps({ src: 'other.png' })
    expect(wr.find('.viv-info-zoom').exists()).toBe(false)
    const img = wr.find('img').element as HTMLImageElement
    Object.defineProperty(img, 'naturalWidth', { value: 500 })
    Object.defineProperty(img, 'naturalHeight', { value: 400 })
    await wr.find('img').trigger('load')
    expect(api(wr).getView()).toEqual({ scale: 2, x: 0, y: 0, fitMode: true })
  })

  test('slots and toolbar=false', async () => {
    const wr = mount(ImageViewer, {
      props: { toolbar: true },
      slots: { 'toolbar-actions': '<button class="mine">X</button>', empty: '<p class="e">Drop a file</p>' },
    })
    expect(wr.find('.viv-toolbar .mine').exists()).toBe(true)
    expect(wr.find('.e').text()).toBe('Drop a file')
    await wr.setProps({ toolbar: false })
    expect(wr.find('.viv-toolbar').exists()).toBe(false)
    wr.unmount()
  })

  test('theme prop sets data-theme', async () => {
    const wr = mountViewer({ theme: 'dark' })
    expect(wr.attributes('data-theme')).toBe('dark')
    await wr.setProps({ theme: 'auto' })
    expect(wr.attributes('data-theme')).toBeUndefined()
  })

  test('emits view-change', async () => {
    const wr = await loadImage()
    api(wr).panBy(10, 0)
    await nextTick()
    const events = wr.emitted('view-change')!
    expect(events[events.length - 1][0]).toEqual({ scale: 0.25, x: 10, y: 150, fitMode: false })
  })
})
