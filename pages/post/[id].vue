<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

interface Comment { id: number; nickname: string; content: string; imageUrl: string; modelUrl: string; modelFileName: string; modelFileSize: number; projectVersionId: number | null; projectVersionLabel: string | null; createdAt: string }
interface ProjectVersion { id: number; versionNumber: number; label: string; note: string; imageUrl: string; modelUrl: string; modelFileName: string; modelFileSize: number; createdAt: string }
interface Post { id: number; nickname: string; title: string; category: string; content: string; imageUrl: string; modelUrl: string; modelFileName: string; modelFileSize: number; createdAt: string; comments: Comment[]; versions: ProjectVersion[] }

const route = useRoute()
const { data: post, pending, error, refresh } = await useFetch<Post>(`/api/posts/${route.params.id}`)
const commentForm = reactive({ nickname: '', content: '', imageUrl: '', modelUrl: '', modelFileName: '', modelFileSize: 0, projectVersionId: null as number | null })
const commentAttachment = ref<File | null>(null)
const commentFileInput = ref<HTMLInputElement | null>(null)
const commentResult = ref('')
const replyFormElement = ref<HTMLElement | null>(null)
const reportForm = reactive({ targetType: 'post' as 'post' | 'comment', commentId: null as number | null, reason: '', details: '' })
const submitting = ref(false)
const errorMessage = ref('')
const reportOpen = ref(false)
const reportSubmitting = ref(false)
const reportError = ref('')
const reportResult = ref('')
const reportEmailSent = ref(false)
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
  commentResult.value = ''
  submitting.value = true
  try {
    if (commentAttachment.value) {
      const body = new FormData()
      body.append('file', commentAttachment.value)
      if (commentAttachment.value.name.toLowerCase().endsWith('.stl')) {
        const uploaded = await $fetch<{ url: string; fileName: string; fileSize: number }>('/api/uploads/stl', { method: 'POST', body })
        commentForm.modelUrl = uploaded.url
        commentForm.modelFileName = uploaded.fileName
        commentForm.modelFileSize = uploaded.fileSize
      } else {
        const uploaded = await $fetch<{ url: string }>('/api/uploads/image', { method: 'POST', body })
        commentForm.imageUrl = uploaded.url
      }
    }
    const result = await $fetch<{ authorNotified: boolean }>(`/api/posts/${route.params.id}/comments`, { method: 'POST', body: commentForm })
    commentResult.value = result.authorNotified
      ? 'Your public reply was posted and the original poster was notified by email.'
      : 'Your public reply was posted. The original poster may not have received an email notification.'
    commentForm.nickname = ''
    commentForm.content = ''
    commentForm.imageUrl = ''
    commentForm.modelUrl = ''
    commentForm.modelFileName = ''
    commentForm.modelFileSize = 0
    commentForm.projectVersionId = null
    commentAttachment.value = null
    if (commentFileInput.value) commentFileInput.value.value = ''
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to publish your reply.'
  } finally {
    submitting.value = false
  }
}

const chooseCommentAttachment = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const isStl = file.name.toLowerCase().endsWith('.stl')
  const validImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  if ((isStl && file.size > 25 * 1024 * 1024) ||
      (!isStl && (!validImage || file.size > 10 * 1024 * 1024))) {
    input.value = ''
    commentAttachment.value = null
    errorMessage.value = 'Choose a JPG, PNG, or WebP image up to 10 MB, or an STL file up to 25 MB.'
    return
  }
  errorMessage.value = ''
  commentAttachment.value = file
}

const focusReplyForm = () => {
  replyFormElement.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  nextTick(() => replyFormElement.value?.querySelector('textarea')?.focus())
}

const openReport = (targetType: 'post' | 'comment', commentId: number | null = null) => {
  reportForm.targetType = targetType
  reportForm.commentId = commentId
  reportForm.reason = ''
  reportForm.details = ''
  reportError.value = ''
  reportResult.value = ''
  reportEmailSent.value = false
  reportOpen.value = true
}

const submitReport = async () => {
  reportError.value = ''
  reportSubmitting.value = true
  try {
    const result = await $fetch<{ id: number; emailSent: boolean }>(`/api/posts/${route.params.id}/reports`, {
      method: 'POST',
      body: reportForm
    })
    reportEmailSent.value = result.emailSent
    reportResult.value = result.emailSent
      ? 'Thank you. Your report was sent to the moderation inbox.'
      : 'Your report was saved, but its email notification could not be sent. Please contact the site administrator.'
  } catch (error: any) {
    reportError.value = error?.data?.statusMessage || 'Unable to submit your report.'
  } finally {
    reportSubmitting.value = false
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
        <img v-if="post.imageUrl && !post.versions.length" :src="post.imageUrl" :alt="`Image for ${post.title}`" class="article-image">
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
          <img
            v-if="selectedVersion?.imageUrl && selectedVersion.imageUrl !== '/default-idea.svg'"
            :src="selectedVersion.imageUrl"
            :alt="`Image for ${selectedVersion.label}`"
            class="version-image"
          >
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
        <div class="content-actions">
          <button type="button" class="report-button" @click="openReport('post')">Report post</button>
          <button type="button" class="button button-secondary contact-author-button" @click="focusReplyForm">Talk to the original poster</button>
        </div>
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
            <button type="button" class="report-button report-reply-button" @click="openReport('comment', comment.id)">Report reply</button>
          </div>
          <span v-if="comment.projectVersionLabel" class="reply-version-tag">{{ comment.projectVersionLabel }}</span>
          <p>{{ comment.content }}</p>
          <img v-if="comment.imageUrl" :src="comment.imageUrl" :alt="`Image attached by ${comment.nickname}`" class="reply-image">
          <a v-if="comment.modelUrl" :href="comment.modelUrl" class="reply-model-link" download>{{ comment.modelFileName || 'Download STL attachment' }} · {{ formatFileSize(comment.modelFileSize) }}</a>
        </article>
      </section>

      <form ref="replyFormElement" class="form-card reply-form" @submit.prevent="submitComment">
        <h2>Join the conversation</h2>
        <div v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</div>
        <div v-if="commentResult" class="form-success" role="status">{{ commentResult }}</div>
        <p class="field-help">Replies are public. If the original poster left a contact email, we will notify them.</p>
        <label class="field-label" for="reply-nickname">Nickname</label>
        <input id="reply-nickname" v-model.trim="commentForm.nickname" class="text-input" maxlength="40" required placeholder="Your nickname">
        <label class="field-label" for="reply-version">Version <span class="optional">Optional</span></label>
        <select id="reply-version" v-model="commentForm.projectVersionId" class="text-input">
          <option :value="null">General discussion</option>
          <option v-for="version in post.versions" :key="version.id" :value="version.id">{{ version.label }}</option>
        </select>
        <label class="field-label" for="reply-content">Reply</label>
        <textarea id="reply-content" v-model.trim="commentForm.content" class="text-input textarea" maxlength="2000" required rows="5" placeholder="Write a helpful reply..."></textarea>
        <label class="field-label" for="reply-attachment">Attach an image or STL <span class="optional">Optional</span></label>
        <input id="reply-attachment" ref="commentFileInput" class="text-input file-input" type="file" accept="image/jpeg,image/png,image/webp,.stl,model/stl" @change="chooseCommentAttachment">
        <p class="field-help">Upload one JPG, PNG, or WebP image up to 10 MB, or one STL file up to 25 MB.</p>
        <p v-if="commentAttachment" class="field-help">{{ commentAttachment.name }} is ready to attach.</p>
        <div class="form-actions"><button class="button button-primary" type="submit" :disabled="submitting">{{ submitting ? 'Publishing...' : 'Publish Reply' }}</button></div>
      </form>
    </template>
    <div v-if="reportOpen" class="report-backdrop" @click.self="reportOpen = false">
      <section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <h2 id="report-title">Report {{ reportForm.targetType === 'post' ? 'post' : 'reply' }}</h2>
        <div v-if="reportError" class="report-error" role="alert">{{ reportError }}</div>
        <div v-if="reportResult" :class="['report-result', reportEmailSent ? 'report-result-success' : 'report-result-warning']" role="status">
          {{ reportResult }}
        </div>
        <form v-else @submit.prevent="submitReport">
          <label class="field-label" for="report-reason">Reason</label>
          <select id="report-reason" v-model="reportForm.reason" class="text-input" required>
            <option value="" disabled>Select a reason</option>
            <option>Spam</option>
            <option>Harassment</option>
            <option>Inappropriate content</option>
            <option>Copyright</option>
            <option>Other</option>
          </select>
          <label class="field-label" for="report-details">Additional details <span class="optional">(optional)</span></label>
          <textarea id="report-details" v-model.trim="reportForm.details" class="text-input textarea" maxlength="1000" rows="4" placeholder="Add context to help us review this report."></textarea>
          <div class="form-actions">
            <button class="button button-secondary" type="button" @click="reportOpen = false">Cancel</button>
            <button class="button button-primary" type="submit" :disabled="reportSubmitting">{{ reportSubmitting ? 'Sending...' : 'Submit report' }}</button>
          </div>
        </form>
        <div v-if="reportResult" class="form-actions">
          <button class="button button-secondary" type="button" @click="reportOpen = false">Close</button>
        </div>
      </section>
    </div>
  </section>
</template>
