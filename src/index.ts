import type { App, Plugin } from 'vue'
import ImageViewer from './ImageViewer.vue'

export { ImageViewer }
export default ImageViewer

export * from './viewMath'
export type {
  ImageLoadInfo,
  ImageViewerExposed,
  ImageViewerProps,
  KeyboardMode,
  Theme,
  ViewState,
} from './types'

/** `app.use(ImageViewerPlugin)` registers `<ImageViewer>` globally. */
export const ImageViewerPlugin: Plugin = {
  install(app: App) {
    app.component('ImageViewer', ImageViewer)
  },
}
