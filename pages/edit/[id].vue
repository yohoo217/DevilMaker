<script setup lang="ts">
interface EditablePost {
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
  rejectionReason: string
  reviewedAt: string | null
  latestRevisionStatus: string | null
  latestRevisionRejectionReason: string | null
  latestRevisionReviewedAt: string | null
}

const route = useRoute()
const token = String(route.query.token || '')
const { data: post, pending, error } = await useFetch<EditablePost>(`/api/posts/${route.params.id}/edit`, { query: { token } })
const form = reactive({ nickname: '', title: '', category: 'Idea', content: '', imageUrl: '', modelUrl: '', modelFileName: '', modelFileSize: 0 })
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : ''

watchEffect(() => {
  if (!post.value) return
  form.nickname = post.value.nickname
  form.title = post.value.title
  form.category = post.value.category
  form.content = post.value.content
  form.imageUrl = post.value.imageUrl === '/default-idea.svg' ? '' : post.value.imageUrl
  form.modelUrl = post.value.modelUrl
  form.modelFileName = post.value.modelFileName
  form.modelFileSize = post.value.modelFileSize
})

const submitEdit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true
  try {
    const result = await $fetch<{ status: string }>(`/api/posts/${route.params.id}/edit`, { method: 'POST', body: { ...form, token } })
    successMessage.value = result.status === 'pending'
      ? 'Your changes were saved and are waiting for admin approval.'
      : 'Your changes were submitted for admin approval. The current post remains public until approval.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to submit this edit.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="form-page">
    <NuxtLink to="/board" class="back-link">← Back to Creative Board</NuxtLink>
    <div v-if="pending" class="state-card">Loading edit page...</div>
    <div v-else-if="error || !post" class="state-card state-error">This edit link is invalid or expired.</div>
    <template v-else>
      <div class="form-heading">
        <p class="eyebrow">CONTRIBUTOR MODE · EDIT POST</p>
        <h1>Update your post</h1>
        <p class="page-description">Your changes will be reviewed by an admin before they become public.</p>
      </div>

      <form class="form-card" @submit.prevent="submitEdit">
        <div v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</div>
        <div v-if="successMessage" class="form-success" role="status">{{ successMessage }}</div>
        <div v-if="post.status === 'pending'" class="status-panel status-pending" role="status">
          <strong>Status: Pending review</strong>
          <span>Your post is waiting for admin approval.</span>
        </div>
        <div v-if="post.status === 'rejected'" class="status-panel status-rejected" role="alert">
          <strong>Status: Rejected</strong>
          <span v-if="post.rejectionReason">Admin note: {{ post.rejectionReason }}</span>
          <span v-else>This post was not approved. You can update it and submit it again.</span>
          <small v-if="post.reviewedAt">Reviewed {{ formatDate(post.reviewedAt) }}</small>
        </div>
        <div v-if="post.latestRevisionStatus === 'pending'" class="status-panel status-pending" role="status">
          <strong>Latest edit: Pending review</strong>
          <span>The current public version remains visible until approval.</span>
        </div>
        <div v-if="post.latestRevisionStatus === 'rejected'" class="status-panel status-rejected" role="alert">
          <strong>Latest edit: Rejected</strong>
          <span v-if="post.latestRevisionRejectionReason">Admin note: {{ post.latestRevisionRejectionReason }}</span>
          <span v-else>You can update the post and submit a new edit for review.</span>
          <small v-if="post.latestRevisionReviewedAt">Reviewed {{ formatDate(post.latestRevisionReviewedAt) }}</small>
        </div>
        <label class="field-label" for="edit-nickname">Nickname</label>
        <input id="edit-nickname" v-model.trim="form.nickname" class="text-input" maxlength="40" required>
        <label class="field-label" for="edit-title">Title</label>
        <input id="edit-title" v-model.trim="form.title" class="text-input" maxlength="120" required>
        <label class="field-label" for="edit-category">Category</label>
        <select id="edit-category" v-model="form.category" class="text-input">
          <option>Idea</option>
          <option>Help</option>
          <option>Project</option>
          <option>Inspiration</option>
        </select>
        <label class="field-label" for="edit-content">Description</label>
        <textarea id="edit-content" v-model.trim="form.content" class="text-input textarea" maxlength="5000" required rows="10"></textarea>
        <label class="field-label" for="edit-image">Image URL <span class="optional">Optional</span></label>
        <input id="edit-image" v-model.trim="form.imageUrl" class="text-input" type="url" placeholder="https://example.com/your-image.jpg">
        <p v-if="form.modelFileName" class="field-help">STL model attached: {{ form.modelFileName }}</p>
        <div class="form-actions">
          <NuxtLink to="/board" class="button button-secondary">Cancel</NuxtLink>
          <button class="button button-primary" type="submit" :disabled="submitting">{{ submitting ? 'Submitting...' : 'Submit Edit' }}</button>
        </div>
      </form>
    </template>
  </section>
</template>
