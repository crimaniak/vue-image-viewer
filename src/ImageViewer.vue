<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DEFAULT_MAX_SCALE,
  DEFAULT_MIN_SCALE,
  DEFAULT_ZOOM_STEP,
  fileName,
  fitView,
  formatZoom,
  panBy as panView,
  recenter,
  scaleLimits,
  wheelFactor,
  zoomTo as zoomView,
  type Size,
  type View,
} from './viewMath'
import type { ImageLoadInfo, ImageViewerExposed, ImageViewerProps, ViewState } from './types'

defineOptions({ name: 'ImageViewer' })

const props = withDefaults(defineProps<ImageViewerProps>(), {
  src: '',
  svg: '',
  name: undefined,
  alt: '',
  toolbar: true,
  keyboard: 'focus',
  theme: 'auto',
  zoomStep: DEFAULT_ZOOM_STEP,
  minScale: DEFAULT_MIN_SCALE,
  maxScale: DEFAULT_MAX_SCALE,
  pixelatedAbove: 3,
  checkerboard: true,
  fallbackSize: 1000,
})

const emit = defineEmits<{
  load: [info: ImageLoadInfo]
  error: [src: string]
  'view-change': [state: ViewState]
}>()

defineSlots<{
  /** Extra toolbar content, after the built-in buttons. */
  'toolbar-actions'?: () => unknown
  /** Shown when both `src` and `svg` are empty. */
  empty?: () => unknown
  /** Shown when the image fails to load. */
  error?: (props: { src: string; svg: boolean }) => unknown
}>()

const root = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const img = ref<HTMLImageElement | null>(null)

type Status = 'empty' | 'loading' | 'loaded' | 'error'
const status = ref<Status>('empty')
const natural = ref<Size>({ w: 0, h: 0 })
const intrinsicSize = ref(true)
const frameSize = ref<Size>({ w: 0, h: 0 })
const view = ref<View>({ scale: 1, x: 0, y: 0 })
const fitMode = ref(true)
const panning = ref(false)

const loaded = computed(() => status.value === 'loaded')
const limits = computed(() =>
  scaleLimits(natural.value, frameSize.value, { min: props.minScale, max: props.maxScale }),
)
// The `svg` prop is shown through a blob URL that this component owns.
const svgUrl = ref('')
function revokeSvgUrl() {
  if (svgUrl.value) URL.revokeObjectURL(svgUrl.value)
  svgUrl.value = ''
}
watch(
  () => props.svg,
  (svg) => {
    revokeSvgUrl()
    if (svg) svgUrl.value = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  },
  { immediate: true },
)
const fromSvg = computed(() => !!svgUrl.value)
const source = computed(() => svgUrl.value || props.src)

const displayName = computed(
  () => props.name ?? (fromSvg.value ? 'SVG' : props.src ? fileName(props.src) : ''),
)
const dimsText = computed(() =>
  intrinsicSize.value ? `${natural.value.w} × ${natural.value.h}` : 'no intrinsic size',
)
const isActual = computed(() => Math.abs(view.value.scale - 1) < 1e-9)
const canZoomIn = computed(() => loaded.value && view.value.scale < limits.value.max - 1e-9)
const canZoomOut = computed(() => loaded.value && view.value.scale > limits.value.min + 1e-9)

const imageStyle = computed(() => ({
  width: natural.value.w + 'px',
  height: natural.value.h + 'px',
  transform: `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
}))
// The checkerboard is sized in screen pixels so its squares don't scale.
const checkerStyle = computed(() => ({
  width: natural.value.w * view.value.scale + 'px',
  height: natural.value.h * view.value.scale + 'px',
  transform: `translate(${view.value.x}px, ${view.value.y}px)`,
}))

// ------------------------------------------------------------- actions --

function measureFrame() {
  const el = frame.value
  if (el) frameSize.value = { w: el.clientWidth, h: el.clientHeight }
}

function setView(v: View, fit: boolean) {
  view.value = v
  fitMode.value = fit
}

function zoomAll() {
  if (!loaded.value) return
  setView(fitView(natural.value, frameSize.value), true)
}

function zoomTo(scale: number, cx = frameSize.value.w / 2, cy = frameSize.value.h / 2) {
  if (!loaded.value) return
  setView(zoomView(view.value, scale, cx, cy, limits.value), false)
}

function zoomBy(factor: number, cx?: number, cy?: number) {
  zoomTo(view.value.scale * factor, cx, cy)
}

const zoom100 = () => zoomTo(1)
const zoomIn = () => zoomBy(props.zoomStep)
const zoomOut = () => zoomBy(1 / props.zoomStep)

function panBy(dx: number, dy: number) {
  if (!loaded.value) return
  setView(panView(view.value, dx, dy), false)
}

function getView(): ViewState {
  return { ...view.value, fitMode: fitMode.value }
}

watch([view, fitMode], () => emit('view-change', getView()))

// ------------------------------------------------------------ keyboard --

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const step = e.shiftKey ? 0.4 : 0.1
  const { w, h } = frameSize.value
  switch (e.key) {
    case '+': case '=': zoomIn(); break
    case '-': case '_': zoomOut(); break
    case 'a': case 'A': zoomAll(); break
    case '1': zoom100(); break
    // Arrows move the view (like scrolling): Right shows more of the right side.
    case 'ArrowLeft': panBy(w * step, 0); break
    case 'ArrowRight': panBy(-w * step, 0); break
    case 'ArrowUp': panBy(0, h * step); break
    case 'ArrowDown': panBy(0, -h * step); break
    default: return
  }
  e.preventDefault()
}

function onRootKeydown(e: KeyboardEvent) {
  if (props.keyboard === 'focus') onKeydown(e)
}

function onWindowKeydown(e: KeyboardEvent) {
  if (isEditable(e.target)) return
  onKeydown(e)
}

watch(
  () => props.keyboard,
  (mode, old) => {
    if (typeof window === 'undefined') return
    if (old === 'global') window.removeEventListener('keydown', onWindowKeydown)
    if (mode === 'global') window.addEventListener('keydown', onWindowKeydown)
  },
  { immediate: true },
)

function focusRoot() {
  if (props.keyboard === 'focus') root.value?.focus({ preventScroll: true })
}

// --------------------------------------------------------------- mouse --

function framePoint(e: MouseEvent) {
  const r = frame.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!e.deltaY) return
  const p = framePoint(e)
  zoomBy(wheelFactor(e.deltaY, e.deltaMode, frameSize.value.h), p.x, p.y)
}

// Middle button: suppress autoscroll / paste, fit on click.
function onMousedown(e: MouseEvent) {
  if (e.button === 1) e.preventDefault()
}

function onAuxclick(e: MouseEvent) {
  if (e.button !== 1) return
  e.preventDefault()
  zoomAll()
}

// Left drag: pan.
let drag: { id: number; x: number; y: number } | null = null

function onPointerdown(e: PointerEvent) {
  if (e.button !== 0 || !loaded.value) return
  e.preventDefault()
  focusRoot()
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
  frame.value?.setPointerCapture?.(e.pointerId)
  panning.value = true
}

function onPointermove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  drag.x = e.clientX
  drag.y = e.clientY
  panBy(dx, dy)
}

function endDrag(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  drag = null
  panning.value = false
}

function onContextmenu(e: MouseEvent) {
  if (drag) e.preventDefault()
}

// -------------------------------------------------------------- resize --

function onResize() {
  const old = frameSize.value
  measureFrame()
  const now = frameSize.value
  if (!loaded.value || (old.w === now.w && old.h === now.h)) return
  view.value = fitMode.value ? fitView(natural.value, now) : recenter(view.value, old, now)
}

let observer: ResizeObserver | null = null

onMounted(() => {
  measureFrame()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(onResize)
    observer.observe(frame.value!)
  } else {
    window.addEventListener('resize', onResize)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  revokeSvgUrl()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onWindowKeydown)
})

// ---------------------------------------------------------------- load --

watch(
  source,
  (src) => {
    drag = null
    panning.value = false
    natural.value = { w: 0, h: 0 }
    intrinsicSize.value = true
    fitMode.value = true
    status.value = src ? 'loading' : 'empty'
  },
  { immediate: true },
)

function onLoad() {
  const el = img.value
  if (!el) return
  let w = el.naturalWidth
  let h = el.naturalHeight
  const hasSize = !!(w && h)
  if (!hasSize) w = h = props.fallbackSize
  natural.value = { w, h }
  intrinsicSize.value = hasSize
  measureFrame()
  status.value = 'loaded'
  // Fitted in the same tick the image becomes visible: no flash at 100%.
  zoomAll()
  emit('load', { src: source.value, width: w, height: h, intrinsicSize: hasSize })
}

function onError() {
  status.value = 'error'
  emit('error', source.value)
}

defineExpose<ImageViewerExposed>({ zoomIn, zoomOut, zoomAll, zoom100, zoomTo, zoomBy, panBy, getView })
</script>

<template>
  <div
    ref="root"
    class="viv"
    :data-theme="theme === 'auto' ? undefined : theme"
    :tabindex="keyboard === 'focus' ? 0 : undefined"
    @keydown="onRootKeydown"
  >
    <header v-if="toolbar" class="viv-toolbar" @mousedown.prevent="focusRoot">
      <div class="viv-tools">
        <button
          type="button"
          class="viv-btn"
          data-action="zoom-in"
          title="Zoom in (+)"
          aria-label="Zoom in"
          :disabled="!canZoomIn"
          @click="zoomIn"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" />
          </svg>
        </button>
        <button
          type="button"
          class="viv-btn"
          data-action="zoom-out"
          title="Zoom out (−)"
          aria-label="Zoom out"
          :disabled="!canZoomOut"
          @click="zoomOut"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21M7.5 10.5h6" />
          </svg>
        </button>
        <span class="viv-sep" aria-hidden="true" />
        <button
          type="button"
          class="viv-btn viv-btn-text"
          data-action="fit"
          title="Fit to window (A)"
          aria-label="Fit to window"
          :aria-pressed="loaded && fitMode"
          :disabled="!loaded"
          @click="zoomAll"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          </svg>
          <span>Fit</span>
        </button>
        <button
          type="button"
          class="viv-btn viv-btn-text"
          data-action="actual"
          title="Actual size, 100% (1)"
          aria-label="Actual size"
          :aria-pressed="loaded && isActual"
          :disabled="!loaded"
          @click="zoom100"
        >
          <span>1:1</span>
        </button>
        <slot name="toolbar-actions" />
      </div>
      <div class="viv-info">
        <span class="viv-info-name" :title="fromSvg ? undefined : src || undefined">{{ displayName }}</span>
        <span v-if="loaded" class="viv-info-dims">{{ dimsText }}</span>
        <span v-if="loaded" class="viv-info-zoom">{{ formatZoom(view.scale) }}</span>
      </div>
    </header>

    <main
      ref="frame"
      class="viv-frame"
      :class="{ 'viv-can-pan': loaded, 'viv-panning': panning }"
      @wheel="onWheel"
      @mousedown="onMousedown"
      @auxclick="onAuxclick"
      @pointerdown="onPointerdown"
      @pointermove="onPointermove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @lostpointercapture="endDrag"
      @contextmenu="onContextmenu"
    >
      <div v-if="checkerboard && loaded" class="viv-checker" :style="checkerStyle" />
      <img
        v-if="source && status !== 'error'"
        v-show="loaded"
        :key="source"
        ref="img"
        class="viv-image"
        :class="{ 'viv-pixelated': view.scale > pixelatedAbove }"
        :style="imageStyle"
        :src="source"
        :alt="alt"
        draggable="false"
        @load="onLoad"
        @error="onError"
      >

      <div v-if="status === 'empty'" class="viv-message">
        <slot name="empty">
          <h1>No image</h1>
          <p>Set the <code>src</code> property to an image URL, or <code>svg</code> to SVG markup.</p>
          <table>
            <tbody>
              <tr><td><kbd>+</kbd> / wheel</td><td>Zoom in</td></tr>
              <tr><td><kbd>−</kbd> / wheel</td><td>Zoom out</td></tr>
              <tr><td><kbd>A</kbd> / middle click</td><td>Fit to window</td></tr>
              <tr><td><kbd>1</kbd></td><td>Actual size (100%)</td></tr>
              <tr><td>arrows / left drag</td><td>Pan</td></tr>
            </tbody>
          </table>
        </slot>
      </div>
      <div v-else-if="status === 'error'" class="viv-message" role="alert">
        <slot name="error" :src="source" :svg="fromSvg">
          <h1>Cannot load image</h1>
          <p v-if="fromSvg">
            The SVG markup is not a valid image. The root element needs
            <code>xmlns="http://www.w3.org/2000/svg"</code>.
          </p>
          <p v-else><code>{{ src }}</code></p>
        </slot>
      </div>
    </main>
  </div>
</template>

<style>
.viv {
  --viv-toolbar-h: 40px;
  --viv-bar-bg: #f3f3f4;
  --viv-bar-fg: #1d1d20;
  --viv-bar-muted: #6b6b73;
  --viv-bar-border: #d6d6db;
  --viv-btn-hover: #e2e2e6;
  --viv-btn-active-bg: #d4def7;
  --viv-btn-active-fg: #1f4fbf;
  --viv-frame-bg: #2b2b2f;
  --viv-msg-fg: #d8d8dc;
  --viv-msg-muted: #a8a8b0;
  --viv-check-a: #cfcfd3;
  --viv-check-b: #f4f4f6;
  --viv-focus: #3b74e6;

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  container-type: inline-size;
  background: var(--viv-frame-bg);
  font: 13px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  outline: none;
}
.viv *, .viv *::before, .viv *::after { box-sizing: border-box; }

@media (prefers-color-scheme: dark) {
  .viv:not([data-theme="light"]) {
    --viv-bar-bg: #1e1e21;
    --viv-bar-fg: #e6e6ea;
    --viv-bar-muted: #9a9aa3;
    --viv-bar-border: #333338;
    --viv-btn-hover: #2e2e33;
    --viv-btn-active-bg: #253556;
    --viv-btn-active-fg: #9dbcff;
    --viv-frame-bg: #141416;
    --viv-check-a: #3a3a3f;
    --viv-check-b: #4a4a50;
    --viv-focus: #6f9bff;
  }
}
.viv[data-theme="dark"] {
  --viv-bar-bg: #1e1e21;
  --viv-bar-fg: #e6e6ea;
  --viv-bar-muted: #9a9aa3;
  --viv-bar-border: #333338;
  --viv-btn-hover: #2e2e33;
  --viv-btn-active-bg: #253556;
  --viv-btn-active-fg: #9dbcff;
  --viv-frame-bg: #141416;
  --viv-check-a: #3a3a3f;
  --viv-check-b: #4a4a50;
  --viv-focus: #6f9bff;
}
.viv:focus-visible { box-shadow: inset 0 0 0 2px var(--viv-focus); }

.viv-toolbar {
  flex: none;
  height: var(--viv-toolbar-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  background: var(--viv-bar-bg);
  color: var(--viv-bar-fg);
  border-bottom: 1px solid var(--viv-bar-border);
  user-select: none;
}

.viv-tools { display: flex; align-items: center; gap: 2px; flex: none; }

.viv-sep {
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: var(--viv-bar-border);
}

.viv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  min-width: 30px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.viv-btn-text { padding: 0 9px; }
.viv-btn:hover { background: var(--viv-btn-hover); }
.viv-btn:focus-visible { outline: 2px solid var(--viv-focus); outline-offset: 1px; }
.viv-btn[aria-pressed="true"] { background: var(--viv-btn-active-bg); color: var(--viv-btn-active-fg); }
.viv-btn:disabled { opacity: .4; cursor: default; background: transparent; }
.viv-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.viv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 14px;
  white-space: nowrap;
  color: var(--viv-bar-muted);
  font-variant-numeric: tabular-nums;
}
.viv-info-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--viv-bar-fg);
  font-weight: 500;
}
.viv-info-zoom { min-width: 4.5ch; text-align: right; }

.viv-frame {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--viv-frame-bg);
  cursor: default;
  touch-action: none;
}
.viv-frame.viv-can-pan { cursor: grab; }
.viv-frame.viv-panning { cursor: grabbing; }

.viv-image, .viv-checker {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
.viv-image {
  max-width: none;
  max-height: none;
  user-select: none;
  -webkit-user-drag: none;
}
.viv-image.viv-pixelated { image-rendering: pixelated; }

.viv-checker {
  background-color: var(--viv-check-b);
  background-image:
    linear-gradient(45deg, var(--viv-check-a) 25%, transparent 25%, transparent 75%, var(--viv-check-a) 75%),
    linear-gradient(45deg, var(--viv-check-a) 25%, transparent 25%, transparent 75%, var(--viv-check-a) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}

.viv-message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  color: var(--viv-msg-fg);
  text-align: center;
  font-size: 14px;
}
.viv-message h1 { margin: 0; font-size: 18px; font-weight: 600; }
.viv-message p { margin: 0; max-width: 60ch; overflow-wrap: anywhere; color: var(--viv-msg-muted); }
.viv-message code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; }
.viv-message table { border-collapse: collapse; margin-top: 6px; text-align: left; }
.viv-message td { padding: 3px 10px; color: #c4c4ca; }
.viv-message td:first-child { text-align: right; }
.viv-message kbd {
  display: inline-block;
  min-width: 1.6em;
  padding: 1px 5px;
  border: 1px solid #55555c;
  border-bottom-width: 2px;
  border-radius: 4px;
  font: 12px ui-monospace, Menlo, Consolas, monospace;
  text-align: center;
}

@container (max-width: 480px) {
  .viv-info-dims { display: none; }
}
</style>
