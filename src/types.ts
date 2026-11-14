import type { View } from './viewMath'

export type KeyboardMode = 'focus' | 'global' | 'none'
export type Theme = 'auto' | 'light' | 'dark'

export interface ImageViewerProps {
  /** Image URL. Empty shows the "No image" message. */
  src?: string
  /**
   * SVG markup to show instead of `src`. Takes priority over `src` when not empty.
   * Shown through a blob URL, so scripts and external resources in it don't load.
   * The root `<svg>` needs `xmlns="http://www.w3.org/2000/svg"`.
   */
  svg?: string
  /** Name shown in the toolbar. Defaults to the decoded file name from `src`, or "SVG" for `svg`. */
  name?: string
  /** `alt` text of the image. */
  alt?: string
  /** Show the toolbar. */
  toolbar?: boolean
  /**
   * Where keyboard shortcuts are listened for:
   * `focus` - on the viewer when it has focus (it takes focus on click),
   * `global` - on the window (ignored while typing in form fields),
   * `none` - off.
   */
  keyboard?: KeyboardMode
  /** Color theme. `auto` follows `prefers-color-scheme`. */
  theme?: Theme
  /** Zoom factor per +/- key or toolbar button press. */
  zoomStep?: number
  /** Lowest scale (the fit scale is always allowed even if lower). */
  minScale?: number
  /** Highest scale (the fit scale is always allowed even if higher). */
  maxScale?: number
  /** Above this scale pixels are drawn sharp (`image-rendering: pixelated`). */
  pixelatedAbove?: number
  /** Draw a checkerboard behind the image, visible through transparency. */
  checkerboard?: boolean
  /** Size used for images without intrinsic size, such as SVGs without width/height. */
  fallbackSize?: number
}

export interface ImageLoadInfo {
  /** The URL that was loaded (a `blob:` URL for the `svg` prop). */
  src: string
  width: number
  height: number
  /** False when the image has no intrinsic size and `fallbackSize` was used. */
  intrinsicSize: boolean
}

export interface ViewState extends View {
  /** True while the view follows the frame size (until the user zooms or pans). */
  fitMode: boolean
}

/** Methods available through a template ref. */
export interface ImageViewerExposed {
  zoomIn(): void
  zoomOut(): void
  /** Fit the image into the frame. */
  zoomAll(): void
  /** Actual size, 100%. */
  zoom100(): void
  /** Absolute scale; the point (cx, cy) in frame pixels stays put (default: frame center). */
  zoomTo(scale: number, cx?: number, cy?: number): void
  /** Relative zoom around (cx, cy) in frame pixels (default: frame center). */
  zoomBy(factor: number, cx?: number, cy?: number): void
  panBy(dx: number, dy: number): void
  getView(): ViewState
}
