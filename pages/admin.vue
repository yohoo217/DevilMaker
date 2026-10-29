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

const adminKey = ref('')
const posts = ref<PendingPost[]>([])
const revisions = ref<PendingRevision[]>([])
const loading = ref(false)
const errorMessage = ref('')
const message = ref('')
const adminVerified = ref(false)

const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const loadPosts = async () => {
  errorMessage.value = ''
  message.value = ''
  loading.value = true
  try {
    const [pendingPosts, pendingRevisions] = await Promise.all([
      $fetch<PendingPost[]>('/api/admin/posts', { headers: { 'x-admin-key': adminKey.value } }),
      $fetch<PendingRevision[]>('/api/admin/revisions', { headers: { 'x-admin-key': adminKey.value } })
    ])
    posts.value = pendingPosts
    revisions.value = pendingRevisions
    adminVerified.value = true
  } catch (error: any) {
    adminVerified.value = false
    errorMessage.value = error?.data?.statusMessage || 'Unable to load pending posts.'
  } finally {
    loading.value = false
  }
}

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
      <img v-if="post.imageUrl && post.imageUrl !== '/default-idea.svg' && !post.imageUrl.startsWith('/api/images/')" :src="post.imageUrl" :alt="`Image for ${post.title}`" class="review-image">
      <p v-if="post.imageUrl.startsWith('/api/images/')" class="model-file">Uploaded image attached for review.</p>
      <p v-if="post.modelUrl" class="model-file">STL: {{ post.modelFileName }} · {{ formatFileSize(post.modelFileSize) }}</p>
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
      <p v-if="revision.imageUrl.startsWith('/api/images/')" class="model-file">Uploaded image attached for review.</p>
      <p v-if="revision.modelUrl" class="model-file">STL: {{ revision.modelFileName }} · {{ formatFileSize(revision.modelFileSize) }}</p>
      <div class="review-actions">
        <button class="button button-primary" type="button" @click="moderateRevision(revision, 'approve')">Approve edit</button>
        <button class="button button-secondary" type="button" @click="moderateRevision(revision, 'reject')">Reject edit</button>
      </div>
    </div>
  </section>
</template>
