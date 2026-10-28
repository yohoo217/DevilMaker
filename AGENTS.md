# Devil Maker Project Rules

## Development workflow

Use the `devil-maker-workflow` skill for work in this project only. Follow its checkpoints for understanding, planning, implementation, verification, and handoff. Do not treat it as a general workflow for other projects.

## Product direction

This is a small discussion forum for maker ideas. Keep the first version easy to understand and easy to change after user feedback.

Use the PTT information structure as inspiration: boards, post lists, post detail pages, and replies. Use a modern interface instead of copying PTT branding or exact visual details.

Do not add complex authentication, payments, fundraising, private messages, or marketplace workflows unless the product plan explicitly changes. The current role plan is intentionally small: Visitor, Contributor, and Admin.

## Role plan

| Role | Initial responsibility |
| --- | --- |
| Visitor | Browse approved posts and read replies |
| Contributor | Use a nickname to publish posts, upload files, reply, and edit their own posts |
| Admin | Approve or reject new posts and post edits during the early launch period |

Do not build full account registration or a general permission system yet. Visitors and contributors may remain anonymous in the first version. The current contributor identity is a nickname plus a private edit token, and the local admin page continues to use `ADMIN_KEY`. Add a separate Moderator role only if community growth creates a clear need.

## Visual rules

Use two clear visual contexts:

| Context | Background | Purpose |
| --- | --- | --- |
| Creative Board | Dark charcoal | Dense forum browsing and category navigation |
| New Post | Dark charcoal | Keep writing inside the same forum visual context |
| Post Detail | Dark charcoal | Keep discussion and model previews inside the forum visual context |
| Admin Approval | Dark charcoal | Review pending posts before publication |

Keep the existing color roles consistent:

| Role | Color direction |
| --- | --- |
| Main board background | Dark charcoal |
| Board surface | Slightly lighter charcoal |
| Main text on dark surfaces | Soft white |
| Secondary text on dark surfaces | Medium gray |
| Accent | Muted gold for labels and actions |
| Light page background | Very light gray green |
| Light page text | Deep green charcoal |

Do not use a light background on New Post. Do not introduce unrelated color systems for individual pages.

The board should prioritize readable article rows over dashboard cards. On small screens, hide nonessential sidebars and image thumbnails while keeping the title, category, author, date, and reply count visible.

## Architecture rules

Keep the application small and use the existing Nuxt structure.

The data model uses `posts`, `post_revisions`, and `comments`. STL files and uploaded images are stored in private local file storage while SQLite stores their metadata. Public APIs remain focused on listing posts, reading one post, creating a post, and creating a comment. Admin approval, edit revisions, and file upload endpoints are separate supporting APIs.

Use SQLite through the existing database utility. Do not add a second database layer or introduce an ORM until there is a clear requirement.

Use server validation for all user submitted text and image URLs. Keep anonymous nicknames as the only identity mechanism in this version.

New posts require admin approval during the early launch period. The local demo admin page uses the `ADMIN_KEY` environment variable, with a development only fallback key. This is not a production authentication system.

After a post is created, its private edit token is shown once to the author. Approved post edits create pending revisions and never replace the public version until an admin approves them.

## Change rules

Prefer small, reversible changes. Keep content, layout, and database logic separated. When adding a feature, update the relevant page, API validation, test coverage, and README only when behavior or setup changes.

Run `npm test` after changes to server behavior. Run `npm run build` after changes to routes, configuration, or production code when the development server is not already running.
