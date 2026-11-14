<script setup lang="ts">
// Demo: a full-window viewer, like the original viewer.html.
// ?src=<url or path> or ?svg=<markup> chooses the image; "Open", drag-and-drop
// and pasting SVG markup (Ctrl+V) also work.
import { onBeforeUnmount, ref } from 'vue'
import { ImageViewer, resolveSrc } from '../src'

const params = new URLSearchParams(location.search)
const src = ref(params.has('src') ? resolveSrc(params.get('src')) : 'samples/landscape.svg')
const svg = ref(params.get('svg') ?? '')
const name = ref<string | undefined>()
const input = ref<HTMLInputElement | null>(null)
let objectUrl = ''

function openFile(file: File | undefined) {
  if (!file) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  src.value = objectUrl
  svg.value = ''
  name.value = file.name
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text/plain').trim() ?? ''
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) return
  svg.value = text
  name.value = 'Pasted SVG'
}
window.addEventListener('paste', onPaste)

function onDrop(e: DragEvent) {
  openFile(e.dataTransfer?.files[0])
}

function onLoad() {
  document.title = name.value ?? (svg.value ? 'SVG' : src.value.split('/').pop()) ?? 'Image Viewer'
}

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <div style="height: 100%" @dragover.prevent @drop.prevent="onDrop">
    <ImageViewer :src="src" :svg="svg" :name="name" keyboard="global" @load="onLoad">
      <template #toolbar-actions>
        <span class="viv-sep" aria-hidden="true" />
        <button type="button" class="viv-btn viv-btn-text" title="Open an image file" @click="input?.click()">
          Open…
        </button>
        <input
          ref="input"
          type="file"
          accept="image/*"
          hidden
          @change="openFile(($event.target as HTMLInputElement).files?.[0])"
        >
      </template>
    </ImageViewer>
  </div>
</template>

