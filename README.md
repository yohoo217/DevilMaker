# Devil Maker

A small English discussion board for sharing maker ideas. The first version uses Nuxt, SQLite, anonymous nicknames, image URLs, and optional STL model previews. It requires Node 22.5 or newer because it uses the built in `node:sqlite` module.

Posts are held for admin approval during the early launch period. Use `/admin` to review pending posts. The admin review screen can preview pending uploaded images and download pending STL files; both stay private until approval. For local development, the admin key defaults to `devil-maker-demo-admin`; set `ADMIN_KEY` to use a different key.

After creating a post, save the private edit link shown on the confirmation message. Every edit creates a pending revision for admin review.

Replies can be associated with an approved project version and include one image or STL attachment. Post authors may optionally add a private email address; public replies notify that address when SMTP is configured. The email address is never included in public post responses. Replies remain public in the discussion.

## Access plan

The first release keeps access simple:

| Access level | Access |
| --- | --- |
| Public user | Browse approved posts, publish with a nickname, upload files, reply with image/STL attachments, and use a private edit link |
| Admin | Approve or reject posts and post edits |

There is no account registration or public user role system yet. Public users remain anonymous, and the admin page uses `ADMIN_KEY`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/board`.

The SQLite database is created at `data/forum.sqlite` on first start. Set `DATABASE_PATH` to use another location.

## Deploy on Railway

Railway needs one persistent Volume because this app keeps both SQLite data and user uploads locally. In the Railway service settings, create a Volume mounted at `/data`, then set these variables:

```bash
DATABASE_PATH=/data/forum.sqlite
UPLOAD_PATH=/data/uploads
ADMIN_KEY=<a long, unique secret>
NODE_ENV=production
```

Railway uses `railway.toml` to build with `npm run build` and start with `npm run start`. Run a single app instance: SQLite and local uploads are intentionally not designed for horizontally scaled instances.

## Report email notifications

Visitors can report a post or reply. Reports are saved in SQLite and emailed to `jyunyanc@gmail.com` using SMTP. Public replies also trigger an email notification to the post author's optional private contact email. Configure these Railway variables to enable delivery:

```bash
SMTP_HOST=<your SMTP host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your SMTP username>
SMTP_PASSWORD=<your SMTP password>
SMTP_FROM=<a sender address authorized by your provider>
APP_BASE_URL=https://<your app domain>
```

For implicit TLS, use the provider's secure port (commonly `465`) and set `SMTP_SECURE=true`. `REPORT_EMAIL` can override the default notification address. Until SMTP is configured, reports are still saved, but the submitter is told the email could not be sent.

## API

`GET /api/posts`

`GET /api/posts/:id`

`POST /api/posts`

`POST /api/posts/:id/comments` (optional `projectVersionId` and one image or STL attachment)

`POST /api/posts/:id/reports`

`GET /api/posts/:id/edit?token=...`

`POST /api/posts/:id/edit`

`GET /api/admin/revisions`

`PATCH /api/admin/revisions/:id`

All text and categories are validated on the server. Replies may only be added to approved posts. Uploads accept JPG, PNG, WebP, and STL files within the limits shown on the submission form, and verify the file signature before storage.

## Test

```bash
npm test
npm run typecheck
```
