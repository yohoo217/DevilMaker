<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

interface Comment { id: number; nickname: string; content: string; createdAt: string }
interface ProjectVersion { id: number; versionNumber: number; label: string; note: string; imageUrl: string; modelUrl: string; modelFileName: string; modelFileSize: number; createdAt: string }
interface Post { id: number; nickname: string; title: string; category: string; content: string; imageUrl: string; modelUrl: string; modelFileName: string; modelFileSize: number; createdAt: string; comments: Comment[]; versions: ProjectVersion[] }

const route = useRoute()
const { data: post, pending, error, refresh } = await useFetch<Post>(`/api/posts/${route.params.id}`)
const commentForm = reactive({ nickname: '', content: '' })
const submitting = ref(false)
const errorMessage = ref('')
const modelViewer = ref<HTMLElement | null>(null)
const selectedVersionId = ref<number | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let animationFrame = 0
let viewerCleanup: (() => void) | null = null

const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const selectedVersion = computed(() => post.value?.versions.find(version => version.id === selectedVersionId.value) || post.value?.versions.at(-1))
const selectedModel = computed(() => selectedVersion.value?.modelUrl ? selectedVersion.value : (post.value?.modelUrl ? post.value : null))

const setupModelViewer = async () => {
  if (!selectedModel.value?.modelUrl || !modelViewer.value) return
  const container = modelViewer.value
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#1f1f1f')
  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 0, 4)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight('#ffffff', '#444444', 2))
  const keyLight = new THREE.DirectionalLight('#ffffff', 2.5)
  keyLight.position.set(3, 4, 5)
  scene.add(keyLight)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = 1
  controls.maxDistance = 12

  try {
    const geometry = await new STLLoader().loadAsync(selectedModel.value.modelUrl)
    geometry.computeBoundingBox()
    geometry.computeVertexNormals()
    const center = geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3()
    const size = geometry.boundingBox?.getSize(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1)
    const largestDimension = Math.max(size.x, size.y, size.z) || 1
    // Center the geometry itself before scaling. Moving the mesh by the unscaled
    // bounding-box center would place small STL files outside the camera view.
    geometry.translate(-center.x, -center.y, -center.z)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#d8a33c', roughness: .68, metalness: .08 }))
    // Leave breathing room inside the preview frame, including when the model
    // is rotated, so the whole shape is visible on first load.
    mesh.scale.setScalar(1.4 / largestDimension)
    // Start at a gentle angle so simple models (such as a calibration cube)
    // read as 3D immediately rather than as a flat, solid-colour face.
    mesh.rotation.set(0.35, 0.55, 0)
    scene.add(mesh)
    controls.target.set(0, 0, 0)
    controls.update()
  } catch {
    container.dataset.error = 'true'
  }

  const resize = () => {
    if (!renderer) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  const render = () => {
    controls.update()
    renderer?.render(scene, camera)
    animationFrame = requestAnimationFrame(render)
  }
  render()
  viewerCleanup = () => {
    observer.disconnect()
    cancelAnimationFrame(animationFrame)
    controls.dispose()
    renderer?.dispose()
    renderer?.domElement.remove()
    geometryCleanup(scene)
    renderer = null
  }
}

const geometryCleanup = (scene: THREE.Scene) => {
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose())
      else object.material.dispose()
    }
  })
}

onMounted(setupModelViewer)
onBeforeUnmount(() => viewerCleanup?.())

watch(() => selectedModel.value?.id, async () => {
  if (!modelViewer.value) return
  viewerCleanup?.()
  viewerCleanup = null
  await nextTick()
  await setupModelViewer()
})

watch(() => post.value?.versions, versions => {
  if (versions?.length && !versions.some(version => version.id === selectedVersionId.value)) selectedVersionId.value = versions.at(-1)?.id || null
}, { immediate: true })

const submitComment = async () => {
  errorMessage.value = ''
  submitting.value = true
  try {
    await $fetch(`/api/posts/${route.params.id}/comments`, { method: 'POST', body: commentForm })
    commentForm.nickname = ''
    commentForm.content = ''
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to publish your reply.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="post-page">
    <NuxtLink to="/board" class="back-link">← Back to Creative Board</NuxtLink>
    <div v-if="pending" class="state-card">Loading post...</div>
    <div v-else-if="error || !post" class="state-card state-error">This post could not be found.</div>
    <template v-else>
      <article class="article-card">
        <div class="article-meta">
          <span class="category-tag">{{ post.category }}</span>
          <span>Posted by <strong>{{ post.nickname }}</strong></span>
          <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
        </div>
        <div class="article-heading">
          <h1>{{ post.title }}</h1>
          <span class="article-reply-count">{{ post.comments.length }} {{ post.comments.length === 1 ? 'reply' : 'replies' }}</span>
        </div>
        <img v-if="post.imageUrl" :src="post.imageUrl" :alt="`Image for ${post.title}`" class="article-image">
        <section v-if="post.versions.length" class="version-section" aria-label="Project version history">
          <div class="version-heading">
            <div>
              <p class="section-kicker">PROJECT PROGRESS</p>
              <h2>{{ post.versions.length }} approved version{{ post.versions.length === 1 ? '' : 's' }}</h2>
            </div>
            <span>Public history</span>
          </div>
          <div class="version-list" role="tablist" aria-label="Project versions">
            <button v-for="version in post.versions" :key="version.id" type="button" :class="['version-item', { active: selectedVersion?.id === version.id }]" role="tab" :aria-selected="selectedVersion?.id === version.id" @click="selectedVersionId = version.id">
              <strong>{{ version.label }}</strong>
              <time :datetime="version.createdAt">{{ formatDate(version.createdAt) }}</time>
            </button>
          </div>
          <p v-if="selectedVersion?.note" class="version-note">{{ selectedVersion.note }}</p>
        </section>
        <section v-if="selectedModel" class="model-section" aria-label="3D model preview">
          <div class="model-heading">
            <div>
              <p class="section-kicker">{{ selectedVersion ? selectedVersion.label : '3D MODEL' }}</p>
              <h2>{{ selectedModel.modelFileName || 'STL model' }}</h2>
            </div>
            <a :href="selectedModel.modelUrl" class="model-download" download>Download STL</a>
          </div>
          <div ref="modelViewer" class="model-viewer">
            <span v-if="false">Loading 3D preview...</span>
          </div>
          <p class="model-help">Drag to rotate. Scroll or pinch to zoom. {{ formatFileSize(selectedModel.modelFileSize) }}</p>
        </section>
        <p class="article-content">{{ post.content }}</p>
      </article>

      <section class="replies-section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">DISCUSSION</p>
            <h2>Replies</h2>
          </div>
          <span>{{ post.comments.length }}</span>
        </div>
        <div v-if="!post.comments.length" class="empty-replies">Be the first to reply.</div>
        <article v-for="comment in post.comments" :key="comment.id" class="reply-card">
          <div class="reply-author">
            <span class="avatar">{{ comment.nickname.charAt(0).toUpperCase() }}</span>
            <strong>{{ comment.nickname }}</strong>
            <time :datetime="comment.createdAt">{{ formatDate(comment.createdAt) }}</time>
          </div>
          <p>{{ comment.content }}</p>
        </article>
      </section>

      <form class="form-card reply-form" @submit.prevent="submitComment">
        <h2>Join the conversation</h2>
        <div v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</div>
        <label class="field-label" for="reply-nickname">Nickname</label>
        <input id="reply-nickname" v-model.trim="commentForm.nickname" class="text-input" maxlength="40" required placeholder="Your nickname">
        <label class="field-label" for="reply-content">Reply</label>
        <textarea id="reply-content" v-model.trim="commentForm.content" class="text-input textarea" maxlength="2000" required rows="5" placeholder="Write a helpful reply..."></textarea>
        <div class="form-actions"><button class="button button-primary" type="submit" :disabled="submitting">{{ submitting ? 'Publishing...' : 'Publish Reply' }}</button></div>
      </form>
    </template>
  </section>
</template>
