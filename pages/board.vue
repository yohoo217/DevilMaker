<script setup lang="ts">
interface PostSummary {
  id: number
  nickname: string
  title: string
  category: string
  content: string
  imageUrl: string
  createdAt: string
  commentCount: number
}

const { data: posts, pending, error, refresh } = await useFetch<PostSummary[]>('/api/posts')

const categories = ['All', 'Idea', 'Help', 'Project', 'Inspiration']
const searchText = ref('')
const selectedCategory = ref('All')
const sortMode = ref('latest')

const { data: filteredPosts, pending: filterPending, error: filterError, refresh: refreshPosts } = await useFetch<PostSummary[]>('/api/posts', {
  query: computed(() => ({
    search: searchText.value || undefined,
    category: selectedCategory.value === 'All' ? undefined : selectedCategory.value,
    sort: sortMode.value
  }))
})

const visiblePosts = computed(() => filteredPosts.value || posts.value || [])

const formatDate = (value: string) => new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date(value))
</script>

<template>
  <section class="board-page">
    <div class="forum-layout">
      <aside class="board-sidebar" aria-label="Board navigation">
        <div class="sidebar-title">Boards</div>
        <nav class="board-nav">
          <NuxtLink to="/board" class="active">Creative Board</NuxtLink>
          <span class="nav-section">Topics</span>
          <button v-for="category in categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">
            {{ category === 'All' ? 'All posts' : category }}
          </button>
        </nav>
        <div class="sidebar-note">A simple place to share ideas and build together.</div>
      </aside>

      <main class="board-main">
        <div class="board-heading">
          <div>
            <p class="eyebrow">DEVIL MAKER COMMUNITY</p>
            <h1>Creative Board</h1>
            <p class="board-subtitle">Latest ideas, questions, and maker projects</p>
          </div>
          <NuxtLink to="/new" class="button button-primary icon-action" aria-label="New Post" data-tooltip="New Post">
            <span aria-hidden="true">＋</span>
          </NuxtLink>
        </div>

        <div class="board-filters" aria-label="Post filters">
          <label class="search-field">
            <span class="sr-only">Search posts</span>
            <input v-model="searchText" type="search" placeholder="Search posts...">
          </label>
          <select v-model="selectedCategory" aria-label="Filter by category">
            <option v-for="category in categories" :key="category" :value="category">{{ category === 'All' ? 'All categories' : category }}</option>
          </select>
          <select v-model="sortMode" aria-label="Sort posts">
            <option value="latest">Latest</option>
            <option value="replies">Most replies</option>
          </select>
          <button v-if="searchText || selectedCategory !== 'All' || sortMode !== 'latest'" class="clear-filters" @click="searchText = ''; selectedCategory = 'All'; sortMode = 'latest'">Clear</button>
        </div>

        <div v-if="pending || filterPending" class="state-card">Loading posts...</div>
        <div v-else-if="error || filterError" class="state-card state-error">
          Unable to load posts.
          <button class="text-button" @click="refreshPosts">Try again</button>
        </div>
        <div v-else-if="!visiblePosts.length" class="state-card">
          No posts match these filters.
        </div>
        <div v-else id="all-posts" class="post-list">
          <NuxtLink v-for="post in visiblePosts" :key="post.id" :to="`/post/${post.id}`" class="post-row">
            <div class="post-main">
              <div class="post-meta">
                <span class="category-tag">{{ post.category }}</span>
              </div>
              <h2>{{ post.title }}</h2>
              <p>{{ post.content }}</p>
              <div class="post-footer">
                <span>{{ post.commentCount }} {{ post.commentCount === 1 ? 'reply' : 'replies' }}</span>
                <span>{{ post.nickname }}</span>
                <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
              </div>
            </div>
            <img v-if="post.imageUrl" :src="post.imageUrl" :alt="`Image for ${post.title}`" class="post-thumbnail">
          </NuxtLink>
        </div>
      </main>

      <aside class="board-rail">
        <div class="about-card">
          <div class="about-mark">M</div>
          <h2>About Creative Board</h2>
          <p>Share useful ideas, ask for feedback, and learn from other makers.</p>
          <NuxtLink to="/new" class="rail-link">Start a discussion →</NuxtLink>
        </div>
      </aside>
    </div>
  </section>
</template>
