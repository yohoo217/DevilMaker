export default defineNuxtConfig({
  devtools: { enabled: true },
  app: {
    head: {
      title: 'Devil Maker'
    }
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    databasePath: process.env.DATABASE_PATH || './data/forum.sqlite',
    adminKey: process.env.ADMIN_KEY || 'devil-maker-demo-admin'
  },
  compatibilityDate: '2024-04-03'
})
