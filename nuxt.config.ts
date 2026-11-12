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
    uploadPath: process.env.UPLOAD_PATH || './data/uploads',
    adminKey: process.env.ADMIN_KEY || 'devil-maker-demo-admin',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    smtpFrom: process.env.SMTP_FROM || '',
    reportEmail: process.env.REPORT_EMAIL || 'jyunyanc@gmail.com',
    appBaseUrl: process.env.APP_BASE_URL || ''
  },
  compatibilityDate: '2024-04-03'
})
