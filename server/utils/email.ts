import nodemailer from 'nodemailer'

interface ReportEmail {
  id: number
  targetType: 'post' | 'comment'
  postId: number
  commentId: number | null
  postTitle: string
  postNickname: string
  contentAuthor: string
  targetContent: string
  reason: string
  details: string
  createdAt: string
}

interface CommentNotification {
  postId: number
  postTitle: string
  recipient: string
  nickname: string
  content: string
}

function createSmtpTransport() {
  const config = useRuntimeConfig()
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword || !config.smtpFrom) return null
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000
  })
}

export async function sendReportEmail(report: ReportEmail) {
  const config = useRuntimeConfig()
  const transporter = createSmtpTransport()
  if (!transporter) {
    console.warn(`Report #${report.id} was saved, but email was not sent because SMTP is not fully configured.`)
    return false
  }

  const baseUrl = config.appBaseUrl.replace(/\/$/, '')
  const postUrl = `${baseUrl}/post/${report.postId}`

  await transporter.sendMail({
    from: config.smtpFrom,
    to: config.reportEmail,
    subject: `[Devil Maker] New ${report.targetType} report #${report.id}`,
    text: [
      `Report #${report.id}`,
      `Type: ${report.targetType}`,
      `Reason: ${report.reason}`,
      `Details: ${report.details || '(none)'}`,
      `Content author: ${report.contentAuthor}`,
      `Post: ${report.postTitle} (#${report.postId})`,
      `Post author: ${report.postNickname}`,
      ...(report.commentId === null ? [] : [`Reported reply: #${report.commentId}`]),
      `Reported content:`,
      report.targetContent,
      `Submitted: ${report.createdAt}`,
      `Post URL: ${postUrl}`
    ].join('\n')
  })
  return true
}

export async function sendCommentNotification(comment: CommentNotification) {
  const config = useRuntimeConfig()
  const transporter = createSmtpTransport()
  if (!transporter) {
    console.warn(`A reply to post #${comment.postId} was saved, but its author was not notified because SMTP is not fully configured.`)
    return false
  }
  const baseUrl = config.appBaseUrl.replace(/\/$/, '')
  await transporter.sendMail({
    from: config.smtpFrom,
    to: comment.recipient,
    subject: `[Devil Maker] New public reply: ${comment.postTitle}`,
    text: [
      `${comment.nickname} replied to your post:`,
      '',
      comment.content,
      '',
      'This reply is public and visible on your post.',
      `View the discussion: ${baseUrl}/post/${comment.postId}`
    ].join('\n')
  })
  return true
}
