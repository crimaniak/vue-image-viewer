// Ported from os_image_viewer/tests/viewer-math.test.js.
import { describe, expect, test } from 'vitest'
import * as M from '../src/viewMath'

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps)
const sz = (w: number, h: number) => ({ w, h })
const lim = (iw: number, ih: number, fw: number, fh: number) => M.scaleLimits(sz(iw, ih), sz(fw, fh))

describe('viewMath', () => {
  test('fit: large image is scaled down and centered', () => {
    expect(M.fitView(sz(4000, 2000), sz(1000, 800))).toEqual({ scale: 0.25, x: 0, y: 150 })
  })

  test('fit: small image is scaled UP to fill the window', () => {
    expect(M.fitView(sz(100, 50), sz(1000, 800))).toEqual({ scale: 10, x: 0, y: 150 })
  })

  test('fit: degenerate sizes give scale 1', () => {
    expect(M.fitScale(sz(0, 0), sz(1000, 800))).toBe(1)
    expect(M.fitScale(sz(100, 100), sz(0, 0))).toBe(1)
  })

  test('zoom 100% from fit keeps the image centered', () => {
    const fit = M.fitView(sz(4000, 2000), sz(1000, 800))
    expect(M.zoomTo(fit, 1, 500, 400, lim(4000, 2000, 1000, 800))).toEqual({ scale: 1, x: -1500, y: -600 })
  })

  test('zoom keeps the image point under the cursor fixed', () => {
    const v0 = { scale: 0.8, x: 37, y: -12 }
    const cx = 123, cy = 456
    const before = [(cx - v0.x) / v0.scale, (cy - v0.y) / v0.scale]
    const v1 = M.zoomBy(v0, 1.7, cx, cy, lim(4000, 2000, 1000, 800))
    near((cx - v1.x) / v1.scale, before[0])
    near((cy - v1.y) / v1.scale, before[1])
  })

  test('zoom does not re-clamp position (image may stay off-center)', () => {
    expect(M.zoomBy({ scale: 1, x: 900, y: 700 }, 2, 0, 0, lim(100, 100, 1000, 800)))
      .toEqual({ scale: 2, x: 1800, y: 1400 })
  })

  test('scale limits always include fit and 100%', () => {
    const huge = lim(100000, 100000, 1000, 800) // fit = 0.008
    expect(huge.min <= 0.008 && huge.max >= 1).toBe(true)
    const tiny = lim(2, 2, 1000, 800) // fit = 400
    expect(tiny.min <= 1 && tiny.max >= 400).toBe(true)
  })

  test('scale limits honour a custom range', () => {
    expect(M.scaleLimits(sz(1000, 1000), sz(1000, 1000), { min: 0.5, max: 4 })).toEqual({ min: 0.5, max: 4 })
  })

  test('zoom is clamped to the limits', () => {
    const l = lim(100, 100, 1000, 800)
    expect(M.zoomTo({ scale: 1, x: 0, y: 0 }, 1e6, 0, 0, l).scale).toBe(l.max)
    expect(M.zoomTo({ scale: 1, x: 0, y: 0 }, 1e-9, 0, 0, l).scale).toBe(l.min)
  })

  test('pan has no limits', () => {
    expect(M.panBy({ scale: 0.25, x: 0, y: 150 }, 5000, -3000)).toEqual({ scale: 0.25, x: 5000, y: -2850 })
  })

  test('resize keeps the image point at the frame center', () => {
    const v0 = { scale: 2, x: -300, y: -100 }
    const p = [(500 - v0.x) / 2, (400 - v0.y) / 2]
    const v1 = M.recenter(v0, sz(1000, 800), sz(1400, 600))
    near((700 - v1.x) / 2, p[0])
    near((300 - v1.y) / 2, p[1])
  })

  test('wheel factor: direction, line/page modes, clamping', () => {
    expect(M.wheelFactor(-100, 0)).toBeGreaterThan(1)
    expect(M.wheelFactor(100, 0)).toBeLessThan(1)
    near(M.wheelFactor(-3, 1), M.wheelFactor(-48, 0))
    near(M.wheelFactor(-1, 2, 300), M.wheelFactor(-300, 0))
    near(M.wheelFactor(-100000, 0), M.wheelFactor(-300, 0))
  })

  test('formatZoom', () => {
    expect(M.formatZoom(0.25)).toBe('25%')
    expect(M.formatZoom(0.0123)).toBe('1.2%')
    expect(M.formatZoom(12.5)).toBe('1250%')
  })

  test('resolveSrc: POSIX paths, Windows paths, URLs, relative', () => {
    expect(M.resolveSrc('/home/x/a b#1%.jpg')).toBe('file:///home/x/a%20b%231%25.jpg')
    expect(M.resolveSrc('/tmp/Фото.png')).toBe('file:///tmp/%D0%A4%D0%BE%D1%82%D0%BE.png')
    expect(M.resolveSrc('C:\\a b\\x.jpg')).toBe('file:///C:/a%20b/x.jpg')
    expect(M.resolveSrc('d:/pics/x.png')).toBe('file:///d:/pics/x.png')
    expect(M.resolveSrc('file:///C:/x.png')).toBe('file:///C:/x.png')
    expect(M.resolveSrc('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(M.resolveSrc('img/a.png')).toBe('img/a.png')
    expect(M.resolveSrc('')).toBe('')
    expect(M.resolveSrc(null)).toBe('')
  })

  test('fileName: decoded last segment', () => {
    expect(M.fileName('file:///a/%D0%BA%20x.png')).toBe('к x.png')
    expect(M.fileName('file:///C:/dir/pic.jpg?x=1#y')).toBe('pic.jpg')
    expect(M.fileName('file:///a/bad%E0.png')).toBe('bad%E0.png')
  })
})
