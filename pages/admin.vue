<script setup lang="ts">
interface PendingPost {
  id: number
  nickname: string
  title: string
  category: string
  content: string
  imageUrl: string
  modelUrl: string
  modelFileName: string
  modelFileSize: number
  status: string
  createdAt: string
}
interface PendingRevision extends PendingPost {
  postId: number
  currentTitle: string
}
interface DatabasePost extends PendingPost {
  reviewedAt: string | null
  rejectionReason: string
}
interface DatabaseComment {
  id: number
  postId: number
  postTitle: string
  nickname: string
  content: string
  createdAt: string
}
interface DatabaseRevision {
  id: number
  postId: number
  nickname: string
  title: string
  category: string
  status: string
  createdAt: string
  reviewedAt: string | null
  rejectionReason: string
}
interface DatabaseOverview {
  summary: { posts: number; approvedPosts: number; pendingPosts: number; comments: number; revisions: number }
  posts: DatabasePost[]
  comments: DatabaseComment[]
  revisions: DatabaseRevision[]
}

const adminKey = ref('')
const posts = ref<PendingPost[]>([])
const revisions = ref<PendingRevision[]>([])
const loading = ref(false)
const errorMessage = ref('')
const message = ref('')
const adminVerified = ref(false)
const imagePreviewUrls = ref<Record<string, string>>({})
const database = ref<DatabaseOverview | null>(null)

const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const isPrivateImage = (url: string) => url.startsWith('/api/images/')
const previewKey = (item: PendingPost | PendingRevision) => 'postId' in item ? `revision-${item.id}` : `post-${item.id}`
const imageSource = (item: PendingPost | PendingRevision) => isPrivateImage(item.imageUrl) ? imagePreviewUrls.value[previewKey(item)] || '' : item.imageUrl

const clearImagePreviews = () => {
  Object.values(imagePreviewUrls.value).forEach(URL.revokeObjectURL)
  imagePreviewUrls.value = {}
}

const loadImagePreview = async (item: PendingPost | PendingRevision) => {
  if (!isPrivateImage(item.imageUrl)) return
  const response = await fetch(item.imageUrl.replace('/api/images/', '/api/admin/images/'), { headers: { 'x-admin-key': adminKey.value } })
  if (!response.ok) throw new Error('Unable to load uploaded image.')
  imagePreviewUrls.value[previewKey(item)] = URL.createObjectURL(await response.blob())
}

const downloadModel = async (item: PendingPost | PendingRevision) => {
  if (!item.modelUrl) return
  try {
    const response = await fetch(item.modelUrl.replace('/api/models/', '/api/admin/models/'), { headers: { 'x-admin-key': adminKey.value } })
    if (!response.ok) throw new Error('Unable to load STL file.')
    const link = document.createElement('a')
    const downloadUrl = URL.createObjectURL(await response.blob())
    link.href = downloadUrl
    link.download = item.modelFileName || 'model.stl'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Unable to download the STL file.'
  }
}

const loadPosts = async () => {
  errorMessage.value = ''
  message.value = ''
  loading.value = true
  clearImagePreviews()
  try {
    const [pendingPosts, pendingRevisions, databaseOverview] = await Promise.all([
      $fetch<PendingPost[]>('/api/admin/posts', { headers: { 'x-admin-key': adminKey.value } }),
      $fetch<PendingRevision[]>('/api/admin/revisions', { headers: { 'x-admin-key': adminKey.value } }),
      $fetch<DatabaseOverview>('/api/admin/database', { headers: { 'x-admin-key': adminKey.value } })
    ])
    posts.value = pendingPosts
    revisions.value = pendingRevisions
    database.value = databaseOverview
    adminVerified.value = true
    await Promise.all([...pendingPosts, ...pendingRevisions].map(item => loadImagePreview(item).catch(() => undefined)))
  } catch (error: any) {
    adminVerified.value = false
    database.value = null
    errorMessage.value = error?.data?.statusMessage || 'Unable to load pending posts.'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(clearImagePreviews)

const moderateRevision = async (revision: PendingRevision, action: 'approve' | 'reject') => {
  const reason = action === 'reject' ? window.prompt('Why should this edit be rejected?') || '' : ''
  if (action === 'reject' && !reason.trim()) return
  try {
    await $fetch(`/api/admin/revisions/${revision.id}`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey.value },
      body: { action, reason }
    })
    revisions.value = revisions.value.filter(item => item.id !== revision.id)
    message.value = action === 'approve' ? 'Edit approved.' : 'Edit rejected.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to update this edit.'
  }
}

const moderate = async (post: PendingPost, action: 'approve' | 'reject') => {
  const reason = action === 'reject' ? window.prompt('Why should this post be rejected?') || '' : ''
  if (action === 'reject' && !reason.trim()) return
  try {
    await $fetch(`/api/admin/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey.value },
      body: { action, reason }
    })
    posts.value = posts.value.filter(item => item.id !== post.id)
    message.value = action === 'approve' ? 'Post approved.' : 'Post rejected.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to update this post.'
  }
}
</script>

<template>
  <section class="admin-page">
    <NuxtLink to="/board" class="back-link">← Back to Creative Board</NuxtLink>
    <div class="form-heading">
      <p class="eyebrow">ADMIN APPROVAL</p>
      <h1>Review pending posts</h1>
      <p class="page-description">Approve ideas before they appear publicly on Devil Maker.</p>
    </div>

    <form class="admin-key-form" @submit.prevent="loadPosts">
      <label class="field-label" for="admin-key">Admin key</label>
      <div class="admin-key-row">
        <input id="admin-key" v-model="adminKey" class="text-input" type="password" required placeholder="Enter admin key">
        <button class="button button-primary" type="submit" :disabled="loading">{{ loading ? 'Loading...' : 'Load posts' }}</button>
      </div>
    </form>

    <div v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</div>
    <div v-if="message" class="form-success" role="status">{{ message }}</div>
    <div v-if="adminVerified" class="role-status" role="status">
      <span class="status-dot"></span>
      <span><strong>Admin access verified.</strong> You are reviewing {{ posts.length + revisions.length }} pending item{{ posts.length + revisions.length === 1 ? '' : 's' }}.</span>
    </div>
    <div v-if="!loading && adminKey && !errorMessage && !posts.length && !revisions.length" class="state-card">No posts or edits are waiting for approval.</div>

    <section v-if="database" class="database-section" aria-label="Database contents">
      <div class="database-heading">
        <div>
          <p class="section-kicker">LIVE SQLITE DATA</p>
          <h2>Database contents</h2>
        </div>
        <span class="database-limit">Latest 100 records per table</span>
      </div>
      <div class="database-summary">
        <div><strong>{{ database.summary.posts }}</strong><span>Posts</span></div>
        <div><strong>{{ database.summary.approvedPosts }}</strong><span>Approved</span></div>
        <div><strong>{{ database.summary.pendingPosts }}</strong><span>Pending</span></div>
        <div><strong>{{ database.summary.comments }}</strong><span>Replies</span></div>
        <div><strong>{{ database.summary.revisions }}</strong><span>Edits</span></div>
      </div>

      <h3 class="database-table-title">Posts</h3>
      <div class="database-records">
        <article v-for="item in database.posts" :key="item.id" class="database-record">
          <div class="review-meta"><span>#{{ item.id }}</span><span class="category-tag">{{ item.category }}</span><span :class="['database-status', `database-status-${item.status}`]">{{ item.status }}</span><span>{{ item.nickname }}</span><time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time></div>
          <h4>{{ item.title }}</h4>
          <p>{{ item.content }}</p>
          <p v-if="item.modelUrl" class="model-file">STL: <a :href="item.modelUrl" download>{{ item.modelFileName }}</a> · {{ formatFileSize(item.modelFileSize) }}</p>
          <p v-if="item.rejectionReason" class="field-help">Rejection reason: {{ item.rejectionReason }}</p>
        </article>
      </div>

      <h3 class="database-table-title">Replies</h3>
      <div v-if="database.comments.length" class="database-records">
        <article v-for="comment in database.comments" :key="comment.id" class="database-record">
          <div class="review-meta"><span>#{{ comment.id }} · Post #{{ comment.postId }}</span><span>{{ comment.nickname }}</span><time :datetime="comment.createdAt">{{ formatDate(comment.createdAt) }}</time></div>
          <h4>{{ comment.postTitle }}</h4>
          <p>{{ comment.content }}</p>
        </article>
      </div>
      <p v-else class="database-empty">No replies stored yet.</p>

      <h3 class="database-table-title">Edit revisions</h3>
      <div v-if="database.revisions.length" class="database-records">
        <article v-for="revision in database.revisions" :key="revision.id" class="database-record">
          <div class="review-meta"><span>#{{ revision.id }} · Post #{{ revision.postId }}</span><span class="category-tag">{{ revision.category }}</span><span :class="['database-status', `database-status-${revision.status}`]">{{ revision.status }}</span><span>{{ revision.nickname }}</span><time :datetime="revision.createdAt">{{ formatDate(revision.createdAt) }}</time></div>
          <h4>{{ revision.title }}</h4>
          <p v-if="revision.rejectionReason" class="field-help">Rejection reason: {{ revision.rejectionReason }}</p>
        </article>
      </div>
      <p v-else class="database-empty">No edit revisions stored yet.</p>
    </section>

    <h2 v-if="posts.length" class="admin-section-title">New posts</h2>
    <div v-for="post in posts" :key="post.id" class="review-card">
      <div class="review-meta">
        <span class="status-tag">PENDING REVIEW</span>
        <span class="category-tag">{{ post.category }}</span>
        <span>{{ post.nickname }}</span>
        <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
      </div>
      <h2>{{ post.title }}</h2>
      <p>{{ post.content }}</p>
      <img v-if="imageSource(post) && post.imageUrl !== '/default-idea.svg'" :src="imageSource(post)" :alt="`Image for ${post.title}`" class="review-image">
      <p v-else-if="isPrivateImage(post.imageUrl)" class="model-file">Uploaded image attached, but its preview could not be loaded.</p>
      <p v-if="post.modelUrl" class="model-file">STL: {{ post.modelFileName }} · {{ formatFileSize(post.modelFileSize) }} <button class="inline-action" type="button" @click="downloadModel(post)">Download for review</button></p>
      <div class="review-actions">
        <button class="button button-primary" type="button" @click="moderate(post, 'approve')">Approve</button>
        <button class="button button-secondary" type="button" @click="moderate(post, 'reject')">Reject</button>
      </div>
    </div>

    <h2 v-if="revisions.length" class="admin-section-title">Post edits</h2>
    <div v-for="revision in revisions" :key="revision.id" class="review-card">
      <div class="review-meta">
        <span class="status-tag">PENDING REVIEW</span>
        <span class="category-tag">EDIT</span>
        <span>Post #{{ revision.postId }}</span>
        <span>{{ revision.nickname }}</span>
        <time :datetime="revision.createdAt">{{ formatDate(revision.createdAt) }}</time>
      </div>
      <p class="field-help">Current title: {{ revision.currentTitle }}</p>
      <h2>{{ revision.title }}</h2>
      <p>{{ revision.content }}</p>
      <img v-if="imageSource(revision) && revision.imageUrl !== '/default-idea.svg'" :src="imageSource(revision)" :alt="`Image for ${revision.title}`" class="review-image">
      <p v-else-if="isPrivateImage(revision.imageUrl)" class="model-file">Uploaded image attached, but its preview could not be loaded.</p>
      <p v-if="revision.modelUrl" class="model-file">STL: {{ revision.modelFileName }} · {{ formatFileSize(revision.modelFileSize) }} <button class="inline-action" type="button" @click="downloadModel(revision)">Download for review</button></p>
      <div class="review-actions">
        <button class="button button-primary" type="button" @click="moderateRevision(revision, 'approve')">Approve edit</button>
        <button class="button button-secondary" type="button" @click="moderateRevision(revision, 'reject')">Reject edit</button>
      </div>
    </div>
  </section>
</template>
