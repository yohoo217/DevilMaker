<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

const form = reactive({ nickname: '', title: '', category: 'Idea', content: '', imageUrl: '', modelUrl: '', modelFileName: '', modelFileSize: 0 })
const submitting = ref(false)
const uploading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const editLink = ref('')
const modelFile = ref<File | null>(null)
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const modelViewer = ref<HTMLElement | null>(null)
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationFrame = 0
let currentMesh: THREE.Mesh | null = null

const initializeViewer = () => {
  if (!modelViewer.value || renderer) return
  const container = modelViewer.value
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#1f1f1f')
  camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 0, 4)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight('#ffffff', '#444444', 2))
  const keyLight = new THREE.DirectionalLight('#ffffff', 2.5)
  keyLight.position.set(3, 4, 5)
  scene.add(keyLight)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 1
  controls.maxDistance = 12

  const resize = () => {
    if (!renderer || !camera) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  const render = () => {
    controls?.update()
    if (scene && camera) renderer?.render(scene, camera)
    animationFrame = requestAnimationFrame(render)
  }
  render()
  onBeforeUnmount(() => {
    observer.disconnect()
    cancelAnimationFrame(animationFrame)
    controls?.dispose()
    renderer?.dispose()
    renderer?.domElement.remove()
  })
}

const showModelPreview = async (file: File) => {
  initializeViewer()
  if (!scene || !camera || !controls) return
  try {
    const geometry = new STLLoader().parse(await file.arrayBuffer())
    geometry.computeBoundingBox()
    geometry.computeVertexNormals()
    if (currentMesh) {
      currentMesh.geometry.dispose()
      ;(currentMesh.material as THREE.Material).dispose()
      scene.remove(currentMesh)
    }
    const center = geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3()
    const size = geometry.boundingBox?.getSize(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1)
    const largestDimension = Math.max(size.x, size.y, size.z) || 1
    currentMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#d8a33c', roughness: .68, metalness: .08 }))
    currentMesh.position.sub(center)
    currentMesh.scale.setScalar(2.5 / largestDimension)
    scene.add(currentMesh)
    camera.position.set(0, 0, 4)
    controls.target.set(0, 0, 0)
    controls.update()
  } catch {
    errorMessage.value = 'This STL file could not be previewed.'
  }
}

const uploadModel = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  errorMessage.value = ''
  if (file.size > 25 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.stl')) {
    input.value = ''
    errorMessage.value = 'Please choose an STL file that is 25 MB or smaller.'
    return
  }
  modelFile.value = file
  form.modelFileName = file.name.slice(0, 180)
  form.modelFileSize = file.size
  await nextTick()
  await showModelPreview(file)
}

const uploadModelFile = async () => {
  if (!modelFile.value || form.modelUrl) return
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', modelFile.value)
    const uploaded = await $fetch<{ url: string }>('/api/uploads/stl', { method: 'POST', body })
    form.modelUrl = uploaded.url
  } finally {
    uploading.value = false
  }
}

const chooseImage = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  errorMessage.value = ''
  if (file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    input.value = ''
    errorMessage.value = 'Please choose a JPG, PNG, or WebP image that is 10 MB or smaller.'
    return
  }
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
}

const uploadImageFile = async () => {
  if (!imageFile.value || form.imageUrl) return
  const body = new FormData()
  body.append('file', imageFile.value)
  const uploaded = await $fetch<{ url: string }>('/api/uploads/image', { method: 'POST', body })
  form.imageUrl = uploaded.url
}

const submitPost = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  editLink.value = ''
  submitting.value = true
  try {
    await uploadImageFile()
    await uploadModelFile()
    const created = await $fetch<{ id: number; editToken: string }>('/api/posts', { method: 'POST', body: form })
    successMessage.value = 'Your post was submitted and is waiting for admin approval.'
    editLink.value = `/edit/${created.id}?token=${created.editToken}`
    form.nickname = ''
    form.title = ''
    form.content = ''
    form.imageUrl = ''
    form.modelUrl = ''
    form.modelFileName = ''
    form.modelFileSize = 0
    imageFile.value = null
    if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = ''
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Please check the form and try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="form-page">
    <NuxtLink to="/board" class="back-link">← Back to Creative Board</NuxtLink>
    <div class="form-heading">
      <p class="eyebrow">START A DISCUSSION</p>
      <h1>Share a new idea</h1>
      <p class="page-description">No account is needed. Use a nickname so people know who they are talking with.</p>
    </div>

    <form class="form-card" @submit.prevent="submitPost">
      <div v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</div>
      <div v-if="successMessage" class="form-success" role="status">{{ successMessage }}</div>
      <div v-if="editLink" class="edit-link-card">
        <strong>Save your private edit link</strong>
        <p>{{ editLink }}</p>
        <NuxtLink :to="editLink" class="button button-secondary">Open Edit Page</NuxtLink>
      </div>
      <label class="field-label" for="nickname">Nickname</label>
      <input id="nickname" v-model.trim="form.nickname" class="text-input" maxlength="40" required placeholder="Your nickname">

      <label class="field-label" for="title">Title</label>
      <input id="title" v-model.trim="form.title" class="text-input" maxlength="120" required placeholder="What are you thinking about?">

      <label class="field-label" for="category">Category</label>
      <select id="category" v-model="form.category" class="text-input">
        <option>Idea</option>
        <option>Help</option>
        <option>Project</option>
        <option>Inspiration</option>
      </select>

      <label class="field-label" for="content">Description</label>
      <textarea id="content" v-model.trim="form.content" class="text-input textarea" maxlength="5000" required rows="8" placeholder="Describe your idea or question..."></textarea>

      <label class="field-label" for="imageFile">Upload image <span class="optional">Optional</span></label>
      <input id="imageFile" class="text-input file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseImage">
      <p v-if="imageFile" class="field-help">{{ imageFile.name }} is ready for admin review.</p>
      <img v-if="imagePreviewUrl" :src="imagePreviewUrl" alt="Preview of the uploaded image" class="image-upload-preview">

      <label class="field-label" for="modelFile">STL model <span class="optional">Optional</span></label>
      <input id="modelFile" class="text-input file-input" type="file" accept=".stl,model/stl" @change="uploadModel">
      <p v-if="uploading" class="field-help">Uploading model...</p>
      <p v-else-if="form.modelFileName" class="field-help">{{ form.modelFileName }} is ready for admin review.</p>
      <p v-else class="field-help">Upload one STL file, up to 25 MB.</p>
      <div v-if="modelFile" class="new-model-preview">
        <div class="model-heading">
          <div>
            <p class="section-kicker">LOCAL PREVIEW</p>
            <h2>Review your model before publishing</h2>
          </div>
        </div>
        <div ref="modelViewer" class="model-viewer"></div>
        <p class="model-help">Drag to rotate. Scroll or pinch to zoom. This preview is only visible to you until the post is approved.</p>
      </div>

      <div class="form-actions">
        <NuxtLink to="/board" class="button button-secondary">Cancel</NuxtLink>
        <button class="button button-primary" type="submit" :disabled="submitting || uploading">{{ submitting ? 'Publishing...' : 'Publish Post' }}</button>
      </div>
    </form>
  </section>
</template>
