/**
 * Pure view math for the image viewer. No DOM access, so it is easy to test
 * and reuse outside the component.
 *
 * A view is `{ scale, x, y }`: the image's top-left corner `(x, y)` in frame
 * pixels, and `scale` = screen pixels per image pixel.
 */

export interface View {
  scale: number
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export interface ScaleRange {
  min: number
  max: number
}

export const DEFAULT_MIN_SCALE = 0.01
export const DEFAULT_MAX_SCALE = 64
export const DEFAULT_ZOOM_STEP = 1.25

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Scale that fits the image into the frame (also enlarges small images). */
export function fitScale(image: Size, frame: Size): number {
  if (image.w <= 0 || image.h <= 0 || frame.w <= 0 || frame.h <= 0) return 1
  return Math.min(frame.w / image.w, frame.h / image.h)
}

/** Allowed scale range. Always contains the fit scale, so "Fit" never gets clamped. */
export function scaleLimits(
  image: Size,
  frame: Size,
  range: ScaleRange = { min: DEFAULT_MIN_SCALE, max: DEFAULT_MAX_SCALE },
): ScaleRange {
  const f = fitScale(image, frame)
  return { min: Math.min(range.min, f), max: Math.max(range.max, f) }
}

/** Image fitted into the frame and centered on both axes. */
export function fitView(image: Size, frame: Size): View {
  const s = fitScale(image, frame)
  return { scale: s, x: (frame.w - image.w * s) / 2, y: (frame.h - image.h * s) / 2 }
}

/**
 * Set an absolute scale (clamped to `limits`), keeping the image point under
 * frame point `(cx, cy)` fixed. Position is not limited: the image may be
 * anywhere, even off-screen.
 */
export function zoomTo(v: View, scale: number, cx: number, cy: number, limits: ScaleRange): View {
  const s = clamp(scale, limits.min, limits.max)
  const k = s / v.scale
  return { scale: s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
}

export function zoomBy(v: View, factor: number, cx: number, cy: number, limits: ScaleRange): View {
  return zoomTo(v, v.scale * factor, cx, cy, limits)
}

/** Free panning: no limits. */
export function panBy(v: View, dx: number, dy: number): View {
  return { scale: v.scale, x: v.x + dx, y: v.y + dy }
}

/**
 * The frame was resized from `oldFrame` to `frame`: keep the image point that
 * was at the old frame center at the new frame center.
 */
export function recenter(v: View, oldFrame: Size, frame: Size): View {
  return { scale: v.scale, x: v.x + (frame.w - oldFrame.w) / 2, y: v.y + (frame.h - oldFrame.h) / 2 }
}

/** Wheel delta to zoom factor. Normalises line and page delta modes. */
export function wheelFactor(deltaY: number, deltaMode: number, pageHeight?: number): number {
  let d = deltaY
  if (deltaMode === 1) d *= 16
  else if (deltaMode === 2) d *= pageHeight || 800
  d = clamp(d, -300, 300)
  return Math.exp(-d * 0.002)
}

/** Zoom percentage as shown in the toolbar: one decimal below 10%. */
export function formatZoom(scale: number): string {
  const pct = scale * 100
  return (pct < 10 ? pct.toFixed(1) : String(Math.round(pct))) + '%'
}

/**
 * Turn a local path or URL into something usable as `<img src>`:
 * `C:\dir\a.jpg` and `/abs/a b.jpg` become encoded `file://` URLs, URLs and
 * relative URLs pass through. Useful for `?src=` style parameters from
 * file-manager launchers. Not applied to the component's `src` automatically,
 * because on the web `/images/a.png` is a server path, not a file path.
 */
export function resolveSrc(raw: string | null | undefined): string {
  if (!raw) return ''
  if (/^[a-z]:[\\/]/i.test(raw)) {
    return (
      'file:///' +
      raw
        .replace(/\\/g, '/')
        .split('/')
        .map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg)))
        .join('/')
    )
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw
  if (raw.charAt(0) === '/') return 'file://' + raw.split('/').map(encodeURIComponent).join('/')
  return raw
}

/** Decoded last path segment of a URL, for display. */
export function fileName(url: string): string {
  const path = url.split(/[?#]/)[0]
  const last = path.split(/[\\/]/).filter(Boolean).pop() || url
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}
