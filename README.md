# @crimaniak/vue-image-viewer

A Vue 3 image viewer component written in TypeScript. It is a port of
[os_image_viewer](https://github.com/crimaniak/os_image_viewer) with the same view behavior, packaged as a
reusable library. The OS launchers and installers are left out.

- Opens fitted to the frame. Small images are enlarged too.
- Zoom with the wheel at the cursor, with `+` / `-`, or from the toolbar.
- Free panning with left drag or the arrow keys.
- Re-fits when the container is resized, unless the user has zoomed or panned.
- Checkerboard behind transparent images. Pixels stay sharp above 300%.
- Light and dark theme. No dependencies besides Vue.

## Install

```sh
npm install @crimaniak/vue-image-viewer
```

```ts
import { ImageViewer } from '@crimaniak/vue-image-viewer'
import '@crimaniak/vue-image-viewer/style.css'
```

Or register it globally: `app.use(ImageViewerPlugin)`.

## Usage

The viewer fills its container, so give the container a height.

```vue
<template>
  <div style="height: 80vh">
    <ImageViewer src="/photos/beach.jpg" @load="info => console.log(info)" />
  </div>
</template>
```

## Controls

| Action | Keyboard | Mouse | Toolbar |
|---|---|---|---|
| Zoom in | `+` | wheel up (zooms at the cursor) | magnifier + |
| Zoom out | `-` | wheel down (zooms at the cursor) | magnifier − |
| Zoom all (fit, also enlarges small images) | `a` | middle click | **Fit** |
| Zoom 100% | `1` | | **1:1** |
| Pan | arrow keys (Shift = bigger step) | left drag | |

Keys pressed with Ctrl, Alt or Cmd are left to the browser.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `src` | `string` | `''` | Image URL. Empty shows a "No image" help screen. |
| `name` | `string` | file name from `src` | Name shown in the toolbar (useful for blob URLs). |
| `alt` | `string` | `''` | |
| `toolbar` | `boolean` | `true` | |
| `keyboard` | `'focus' \| 'global' \| 'none'` | `'focus'` | `focus`: keys work while the viewer has focus. It takes focus on click. `global`: keys are read on `window`, except while typing in form fields. |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | |
| `zoomStep` | `number` | `1.25` | Factor per key or button press. |
| `minScale` / `maxScale` | `number` | `0.01` / `64` | The fit scale is always allowed, even outside this range. |
| `pixelatedAbove` | `number` | `3` | |
| `checkerboard` | `boolean` | `true` | |
| `fallbackSize` | `number` | `1000` | Size used for images without intrinsic size, such as SVGs without width and height. |

## Events

- `load(info: { src, width, height, intrinsicSize })`
- `error(src)`
- `view-change(state: { scale, x, y, fitMode })`

## Slots

- `toolbar-actions`: extra toolbar content after the built-in buttons. The `viv-btn`, `viv-btn-text` and `viv-sep` classes match the built-in look.
- `empty`: replaces the "No image" screen.
- `error` (`{ src }`): replaces the "Cannot load image" screen.

## Methods (template ref)

`zoomIn()`, `zoomOut()`, `zoomAll()`, `zoom100()`, `zoomTo(scale, cx?, cy?)`,
`zoomBy(factor, cx?, cy?)`, `panBy(dx, dy)`, `getView()`. Coordinates are frame
pixels. The default point is the frame center.

## Styling

All classes start with `viv-`. Colors are CSS custom properties on `.viv`, such as
`--viv-frame-bg`, `--viv-bar-bg`, `--viv-toolbar-h` and `--viv-check-a`/`-b`.
Override them on the component or a parent.

## View math

The pure functions are exported as well. They include `fitView`, `zoomTo`, `zoomBy`,
`panBy`, `recenter`, `scaleLimits`, `wheelFactor` and `formatZoom`. Also exported are
`resolveSrc`, which turns `C:\a b.jpg` or `/home/x/a.jpg` into an encoded `file://`
URL, and `fileName`. The component does not apply `resolveSrc` to `src`: on the web,
`/images/a.png` is a server path.

## Development

```sh
npm run dev        # demo: full-window viewer, ?src=<url>, "Open…" button, drag and drop
npm test           # vitest: view math + component tests (jsdom)
npm run typecheck
npm run build      # dist/: ES + UMD bundles, style.css, .d.ts
```
