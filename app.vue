<script setup lang="ts">
useHead({ title: 'Devil Maker' })
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <NuxtLink to="/board" class="brand">
        <span class="brand-mark">M</span>
        <span>Devil Maker</span>
      </NuxtLink>
      <nav class="site-nav" aria-label="Main navigation">
        <NuxtLink to="/board">Creative Board</NuxtLink>
        <NuxtLink to="/new" class="nav-action icon-action" aria-label="New Post" data-tooltip="New Post">
          <span aria-hidden="true">＋</span>
        </NuxtLink>
      </nav>
    </header>
    <main class="page-content">
      <NuxtPage />
    </main>
    <footer class="site-footer">A simple place to share ideas and build together.</footer>
  </div>
</template>
