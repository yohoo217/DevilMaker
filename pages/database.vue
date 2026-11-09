<script setup lang="ts">
const adminKey = ref('')
const database = ref<unknown>(null)
const errorMessage = ref('')
const loading = ref(false)
const loadDatabase = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    database.value = await $fetch('/api/admin/database', { headers: { 'x-admin-key': adminKey.value } })
  } catch (error: any) {
    database.value = null
    errorMessage.value = error?.data?.statusMessage || 'Unable to load database contents.'
  } finally { loading.value = false }
}
</script>
<template>
  <section class="admin-page">
    <NuxtLink to="/admin" class="back-link">← Back to admin approval</NuxtLink>
    <div class="form-heading"><p class="eyebrow">ADMIN ONLY</p><h1>Database contents</h1><p class="page-description">View the latest 100 records from posts, replies, and edit revisions.</p></div>
    <form class="admin-key-form" @submit.prevent="loadDatabase">
      <label class="field-label" for="admin-key">Admin key</label>
      <div class="admin-key-row"><input id="admin-key" v-model="adminKey" class="text-input" type="password" required placeholder="Enter admin key"><button class="button button-primary" type="submit" :disabled="loading">{{ loading ? 'Loading...' : 'Load database' }}</button></div>
    </form>
    <div v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</div>
    <pre v-if="database" class="database-output">{{ JSON.stringify(database, null, 2) }}</pre>
  </section>
</template>
