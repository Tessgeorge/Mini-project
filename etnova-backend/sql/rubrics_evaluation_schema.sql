create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  stage varchar(16) not null check (stage in ('review', 'guide', 'ese')),
  title varchar(255) not null,
  max_marks integer not null check (max_marks > 0),
  order_no integer not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_rubrics_stage_order
  on public.rubrics(stage, order_no);

alter table if exists public.review_marks
  add column if not exists rubric_id uuid references public.rubrics(id),
  add column if not exists review_stage varchar(32),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.guide_marks
  add column if not exists rubric_id uuid references public.rubrics(id),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.ese_marks
  add column if not exists rubric_id uuid references public.rubrics(id),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'review_marks'
      and constraint_name = 'review_marks_student_rubric_unique'
  ) then
    alter table public.review_marks
      drop constraint review_marks_student_rubric_unique;
  end if;
exception
  when undefined_table then null;
  when undefined_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'review_marks'
  ) then
    begin
      alter table public.review_marks
        add constraint review_marks_student_rubric_stage_evaluator_unique unique (student_id, rubric_id, review_stage, evaluator_id);
    exception
      when duplicate_table then null;
      when duplicate_object then null;
    end;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'guide_marks'
  ) then
    begin
      alter table public.guide_marks
        add constraint guide_marks_student_rubric_unique unique (student_id, rubric_id);
    exception
      when duplicate_table then null;
      when duplicate_object then null;
    end;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ese_marks'
  ) then
    begin
      alter table public.ese_marks
        add constraint ese_marks_student_rubric_unique unique (student_id, rubric_id);
    exception
      when duplicate_table then null;
      when duplicate_object then null;
    end;
  end if;
end $$;

create table if not exists public.final_results (
  student_id uuid primary key references public.profiles(id),
  attendance_marks integer not null default 0,
  report_marks integer not null default 0,
  review_total numeric(6,2) not null default 0,
  guide_total numeric(6,2) not null default 0,
  ese_total numeric(6,2) not null default 0,
  cie_total numeric(6,2) not null default 0,
  final_marks numeric(6,2) not null default 0,
  status varchar(32) not null default 'pending',
  is_published boolean not null default false,
  published_at timestamptz null,
  published_by uuid null references public.profiles(id),
  locked_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table if exists public.final_results
  add column if not exists attendance_marks integer not null default 0,
  add column if not exists report_marks integer not null default 0,
  add column if not exists review_total numeric(6,2) not null default 0,
  add column if not exists guide_total numeric(6,2) not null default 0,
  add column if not exists ese_total numeric(6,2) not null default 0,
  add column if not exists cie_total numeric(6,2) not null default 0,
  add column if not exists final_marks numeric(6,2) not null default 0,
  add column if not exists status varchar(32) not null default 'pending',
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz null,
  add column if not exists published_by uuid null references public.profiles(id),
  add column if not exists locked_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.final_results
  alter column attendance_marks set default 0,
  alter column report_marks set default 0;
