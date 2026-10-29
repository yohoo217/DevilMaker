# Devil Maker

A small English discussion board for sharing maker ideas. The first version uses Nuxt, SQLite, anonymous nicknames, image URLs, and optional STL model previews. It requires Node 22.5 or newer because it uses the built in `node:sqlite` module.

Posts are held for admin approval during the early launch period. Use `/admin` to review pending posts. Uploaded STL files and images are stored privately until their post is approved. For local development, the admin key defaults to `devil-maker-demo-admin`; set `ADMIN_KEY` to use a different key.

After creating a post, save the private edit link shown on the confirmation message. Every edit creates a pending revision for admin review.

## Access plan

The first release keeps access simple:

| Access level | Access |
| --- | --- |
| Public user | Browse approved posts, publish with a nickname, upload files, reply, and use a private edit link |
| Admin | Approve or reject posts and post edits |

There is no account registration or public user role system yet. Public users remain anonymous, and the admin page uses `ADMIN_KEY`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/board`.

The SQLite database is created at `data/forum.sqlite` on first start. Set `DATABASE_PATH` to use another location.

## API

`GET /api/posts`

`GET /api/posts/:id`

`POST /api/posts`

`POST /api/posts/:id/comments`

`GET /api/posts/:id/edit?token=...`

`POST /api/posts/:id/edit`

`GET /api/admin/revisions`

`PATCH /api/admin/revisions/:id`

## Test

```bash
npm test
```
