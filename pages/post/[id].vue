<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

interface Comment { id: number; nickname: string; content: string; createdAt: string }
interface Post { id: number; nickname: string; title: string; category: string; content: string; imageUrl: string; modelUrl: string; modelFileName: string; modelFileSize: number; createdAt: string; comments: Comment[] }

const route = useRoute()
const { data: post, pending, error, refresh } = await useFetch<Post>(`/api/posts/${route.params.id}`)
const commentForm = reactive({ nickname: '', content: '' })
const submitting = ref(false)
const errorMessage = ref('')
const modelViewer = ref<HTMLElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let animationFrame = 0
let viewerCleanup: (() => void) | null = null

const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const setupModelViewer = async () => {
  if (!post.value?.modelUrl || !modelViewer.value) return
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
    const geometry = await new STLLoader().loadAsync(post.value.modelUrl)
    geometry.computeBoundingBox()
    geometry.computeVertexNormals()
    const center = geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3()
    const size = geometry.boundingBox?.getSize(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1)
    const largestDimension = Math.max(size.x, size.y, size.z) || 1
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#d8a33c', roughness: .68, metalness: .08 }))
    mesh.position.sub(center)
    mesh.scale.setScalar(2.5 / largestDimension)
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
        <section v-if="post.modelUrl" class="model-section" aria-label="3D model preview">
          <div class="model-heading">
            <div>
              <p class="section-kicker">3D MODEL</p>
              <h2>{{ post.modelFileName || 'STL model' }}</h2>
            </div>
            <a :href="post.modelUrl" class="model-download" download>Download STL</a>
          </div>
          <div ref="modelViewer" class="model-viewer">
            <span v-if="false">Loading 3D preview...</span>
          </div>
          <p class="model-help">Drag to rotate. Scroll or pinch to zoom. {{ formatFileSize(post.modelFileSize) }}</p>
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
