-- ===========================================
-- 0013_backoffice_task_tracker.sql
-- ===========================================
-- migrate:up
create table if not exists public.backoffice_task_statuses (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    category text not null default 'todo',
    order_index integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists backoffice_task_statuses_name_idx
    on public.backoffice_task_statuses(lower(name));

create table if not exists public.backoffice_tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    owner text,
    status_id uuid not null references public.backoffice_task_statuses(id) on delete restrict,
    start_date date,
    due_date date,
    priority text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists backoffice_tasks_status_idx
    on public.backoffice_tasks(status_id);

create table if not exists public.backoffice_task_dependencies (
    task_id uuid not null references public.backoffice_tasks(id) on delete cascade,
    depends_on_task_id uuid not null references public.backoffice_tasks(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint backoffice_task_dependencies_pk primary key (task_id, depends_on_task_id),
    constraint backoffice_task_dependencies_self check (task_id <> depends_on_task_id)
);

create index if not exists backoffice_task_dependencies_blocker_idx
    on public.backoffice_task_dependencies(depends_on_task_id);

comment on table public.backoffice_task_statuses is 'Configurable workflow states for backoffice implementation tracking.';
comment on table public.backoffice_tasks is 'Backoffice implementation tasks with owner, schedule, and workflow status.';
comment on table public.backoffice_task_dependencies is 'Join table tracking task-to-task blocking relationships.';

insert into public.backoffice_task_statuses (name, description, category, order_index)
select * from (values
    ('To Do', 'Work that has not yet been started.', 'todo', 0),
    ('In Progress', 'Active engineering or design effort.', 'in_progress', 1),
    ('In Review', 'Awaiting review, validation, or QA sign-off.', 'review', 2),
    ('Done', 'Completed tasks ready to close out.', 'done', 3)
) as defaults(name, description, category, order_index)
where not exists (
    select 1 from public.backoffice_task_statuses existing
    where lower(existing.name) = lower(defaults.name)
);

-- migrate:down
drop table if exists public.backoffice_task_dependencies cascade;
drop table if exists public.backoffice_tasks cascade;
drop index if exists backoffice_task_statuses_name_idx;
drop table if exists public.backoffice_task_statuses cascade;
