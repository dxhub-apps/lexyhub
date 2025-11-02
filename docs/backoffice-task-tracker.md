# Backoffice Task Tracker

The backoffice now includes a dedicated task workspace at `/admin/backoffice/tasks` that mirrors Jira-style
planning directly inside LexyHub. Administrators can configure workflow statuses, create tasks, and map
blocking dependencies without leaving the admin environment.

## Capabilities

- **Custom workflow statuses:** Add, edit, and delete workflow states with ordering metadata so columns
  reflect your preferred delivery cadence. Four baseline states (`To Do`, `In Progress`, `In Review`, and
  `Done`) seed automatically via the `0013_backoffice_task_tracker.sql` migration.
- **Task CRUD:** Capture title, owner, description, start and due dates, plus select a workflow status for
  each task. Tasks render in columnar swim lanes grouped by status to provide an instant kanban view.
- **Dependency mapping:** Multi-select dependency management lets you flag upstream blockers. The UI calls
  out "Blocked by" tasks so sequencing issues are visible while planning.
- **Admin scoped:** Access to the UI and APIs now requires an authenticated admin session. Eligibility is determined by Supabase
  metadata or the `LEXYHUB_ADMIN_EMAILS` allowlist; the legacy `x-user-role` header is no longer trusted for authorization.

## API reference

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/admin/task-statuses` | List configured statuses ordered by `order_index`. |
| `POST` | `/api/admin/task-statuses` | Create a new status. Body accepts `name`, `description`, `category`, `order_index`. |
| `PUT` | `/api/admin/task-statuses` | Update a status. Provide `id` plus any fields to change. |
| `DELETE` | `/api/admin/task-statuses?id=<uuid>` | Remove a status (must not be in use). |
| `GET` | `/api/admin/tasks` | List tasks with dependency metadata. |
| `POST` | `/api/admin/tasks` | Create a task. Requires `title` and `status_id`; accepts optional fields and `dependencies` array. |
| `PUT` | `/api/admin/tasks` | Update an existing task. Provide `id` and fields to change; include `dependencies` to replace links. |
| `DELETE` | `/api/admin/tasks?id=<uuid>` | Delete a task and cascade dependency edges. |

All routes are dynamic Node handlers so Supabase access remains server-side. They leverage the shared
`@/lib/backoffice/tasks` service for validation and Supabase interactions.

## Database schema

Migration `0013_backoffice_task_tracker.sql` introduces three tables:

- `backoffice_task_statuses` — stores workflow metadata with `name`, `description`, `category`, and
  `order_index`. Unique constraint on `lower(name)` prevents duplicates.
- `backoffice_tasks` — captures core task data including owner, schedule, and JSON `metadata` for future
  extensions. `status_id` references `backoffice_task_statuses`.
- `backoffice_task_dependencies` — join table linking tasks to the tasks that block them. Primary key
  `(task_id, depends_on_task_id)` ensures uniqueness and a `CHECK` prevents self-dependency cycles.

## Usage tips

- Use the "Plan tasks" link from the backoffice overview to jump into the workspace.
- The first status in `order_index` becomes the default selection when creating new tasks.
- Dependencies are recalculated on every edit—submit the form even if you only remove blockers.
- Statuses cannot be deleted while tasks reference them; change affected tasks first.
- The kanban columns update instantly after each mutation thanks to the shared load routine.
- Fresh environments now seed a provider-integration swim lane: Google Ads and Etsy connectors land in **In Progress** so the
  integrations team can keep momentum, while Pinterest and Reddit discovery tasks populate **To Do** for rapid assignment once
  upstream access is granted.

## Future enhancements

- Swim lane filtering by owner or due date for portfolio-style reporting.
- Bulk drag-and-drop reordering once the UI introduces a client-side sortable primitive.
- Notifications when tasks approach due dates, leveraging the `due_date` column and Supabase cron.

