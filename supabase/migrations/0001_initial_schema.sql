-- Initial Supabase/Postgres schema for Grade Law Study.
-- Execute in Supabase SQL editor or via Supabase migrations.

create extension if not exists "pgcrypto";

create type question_status as enum (
  'pending',
  'in_practice',
  'answered',
  'mastered',
  'needs_review',
  'excluded'
);

create type difficulty as enum ('low', 'medium', 'high');
create type answer_mode as enum ('text', 'voice');
create type practice_mode as enum (
  'random',
  'manual',
  'by_subject',
  'by_professor',
  'by_difficulty',
  'review',
  'weak_questions',
  'unpracticed'
);
create type source_document_type as enum ('pdf', 'docx', 'xlsx', 'manual');
create type question_origin as enum ('real_question', 'generated', 'manual');

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table professors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

create table law_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references law_areas(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(area_id, name)
);

create table subsubjects (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(subject_id, name)
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null unique,
  document_type source_document_type not null,
  area_id uuid references law_areas(id),
  metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table professor_topic_priorities (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references professors(id) on delete cascade,
  area_id uuid not null references law_areas(id) on delete cascade,
  subarea text not null,
  frecuencia integer not null,
  professor_percentage numeric(5,2) not null,
  syllabus_alignment text not null,
  relevance text not null,
  priority_score numeric(8,2) not null,
  created_at timestamptz not null default now(),
  unique(professor_id, area_id, subarea)
);

create table raw_questions (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references source_documents(id) on delete cascade,
  area_name text,
  professor_name text,
  statement text not null,
  raw_answer text,
  order_index integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  statement text not null,
  area_id uuid not null references law_areas(id),
  subject_id uuid references subjects(id),
  subsubject_id uuid references subsubjects(id),
  difficulty difficulty not null default 'medium',
  estimated_probability numeric(6,2) not null default 0,
  priority_score numeric(8,2) not null default 0,
  question_type text,
  is_active boolean not null default true,
  origin question_origin not null default 'generated',
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table question_professors (
  question_id uuid not null references questions(id) on delete cascade,
  professor_id uuid not null references professors(id) on delete cascade,
  primary key (question_id, professor_id)
);

create table expected_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  model_answer text not null,
  rubric_notes text,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table key_points (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  label text not null,
  description text not null,
  weight numeric(5,2) not null default 1,
  is_required boolean not null default true,
  order_index integer not null default 0
);

create table common_errors (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  description text not null,
  severity text not null default 'medium'
);

create table related_questions (
  question_id uuid not null references questions(id) on delete cascade,
  related_question_id uuid not null references questions(id) on delete cascade,
  relation_type text not null default 'related',
  primary key (question_id, related_question_id),
  constraint related_questions_no_self check (question_id <> related_question_id)
);

create table student_question_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  status question_status not null default 'pending',
  is_excluded boolean not null default false,
  is_favorite boolean not null default false,
  confidence_level integer check (confidence_level between 1 and 5),
  last_attempt_at timestamptz,
  best_score numeric(6,2) not null default 0,
  average_score numeric(6,2) not null default 0,
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, question_id)
);

create table practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  mode practice_mode not null,
  filters jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_questions integer not null default 0,
  average_score numeric(6,2) not null default 0,
  total_time_seconds integer not null default 0
);

create table practice_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references practice_sessions(id) on delete set null,
  user_id uuid not null references user_profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer_mode answer_mode not null,
  raw_answer text,
  transcription text,
  audio_path text,
  score numeric(6,2) not null default 0,
  rubric_score jsonb not null default '{}'::jsonb,
  time_seconds integer,
  post_status question_status not null default 'answered',
  created_at timestamptz not null default now()
);

create table attempt_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references practice_attempts(id) on delete cascade,
  summary text not null,
  correct_points jsonb not null default '[]'::jsonb,
  missing_points jsonb not null default '[]'::jsonb,
  conceptual_errors jsonb not null default '[]'::jsonb,
  improvement_suggestions text,
  model_answer_suggested text,
  created_at timestamptz not null default now()
);

create table attempt_key_points (
  attempt_id uuid not null references practice_attempts(id) on delete cascade,
  key_point_id uuid not null references key_points(id) on delete cascade,
  matched boolean not null default false,
  confidence numeric(5,2) not null default 0,
  comment text,
  primary key (attempt_id, key_point_id)
);

-- Query indexes: keep filtering paths fast without over-indexing everything.
create index professor_topic_priorities_area_score_idx on professor_topic_priorities(area_id, priority_score desc);
create index professor_topic_priorities_professor_score_idx on professor_topic_priorities(professor_id, priority_score desc);
create index raw_questions_professor_idx on raw_questions(professor_name);
create index raw_questions_area_idx on raw_questions(area_name);
create index questions_area_score_idx on questions(area_id, priority_score desc);
create index questions_subject_idx on questions(subject_id);
create index questions_subsubject_idx on questions(subsubject_id);
create index questions_difficulty_idx on questions(difficulty);
create index questions_active_idx on questions(is_active) where is_active = true;
create index expected_answers_question_active_idx on expected_answers(question_id, is_active);
create index key_points_question_idx on key_points(question_id);
create index student_question_states_user_status_idx on student_question_states(user_id, status);
create index student_question_states_user_excluded_idx on student_question_states(user_id, is_excluded);
create index practice_sessions_user_started_idx on practice_sessions(user_id, started_at desc);
create index practice_attempts_user_created_idx on practice_attempts(user_id, created_at desc);
create index practice_attempts_question_created_idx on practice_attempts(question_id, created_at desc);

-- Updated-at helper.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_user_profiles_updated_at
before update on user_profiles
for each row execute function set_updated_at();

create trigger set_questions_updated_at
before update on questions
for each row execute function set_updated_at();

create trigger set_student_question_states_updated_at
before update on student_question_states
for each row execute function set_updated_at();

-- RLS: public study content can be read by authenticated users; personal progress is isolated by auth.uid().
alter table user_profiles enable row level security;
alter table student_question_states enable row level security;
alter table practice_sessions enable row level security;
alter table practice_attempts enable row level security;
alter table attempt_feedback enable row level security;
alter table attempt_key_points enable row level security;

create policy "Users can read own profile" on user_profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on user_profiles
  for update using (auth.uid() = id);

create policy "Users manage own question states" on student_question_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own practice sessions" on practice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own attempts" on practice_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read feedback for own attempts" on attempt_feedback
  for select using (
    exists (
      select 1 from practice_attempts pa
      where pa.id = attempt_feedback.attempt_id and pa.user_id = auth.uid()
    )
  );

create policy "Users read key point matches for own attempts" on attempt_key_points
  for select using (
    exists (
      select 1 from practice_attempts pa
      where pa.id = attempt_key_points.attempt_id and pa.user_id = auth.uid()
    )
  );

-- Public read policies for curated content. Writes should go through admin/server role.
alter table professors enable row level security;
alter table law_areas enable row level security;
alter table subjects enable row level security;
alter table subsubjects enable row level security;
alter table source_documents enable row level security;
alter table professor_topic_priorities enable row level security;
alter table raw_questions enable row level security;
alter table questions enable row level security;
alter table question_professors enable row level security;
alter table expected_answers enable row level security;
alter table key_points enable row level security;
alter table common_errors enable row level security;
alter table related_questions enable row level security;

create policy "Authenticated users can read professors" on professors for select to authenticated using (true);
create policy "Authenticated users can read areas" on law_areas for select to authenticated using (true);
create policy "Authenticated users can read subjects" on subjects for select to authenticated using (true);
create policy "Authenticated users can read subsubjects" on subsubjects for select to authenticated using (true);
create policy "Authenticated users can read source documents" on source_documents for select to authenticated using (true);
create policy "Authenticated users can read priorities" on professor_topic_priorities for select to authenticated using (true);
create policy "Authenticated users can read raw questions" on raw_questions for select to authenticated using (true);
create policy "Authenticated users can read active questions" on questions for select to authenticated using (is_active = true);
create policy "Authenticated users can read question professors" on question_professors for select to authenticated using (true);
create policy "Authenticated users can read expected answers" on expected_answers for select to authenticated using (is_active = true);
create policy "Authenticated users can read key points" on key_points for select to authenticated using (true);
create policy "Authenticated users can read common errors" on common_errors for select to authenticated using (true);
create policy "Authenticated users can read related questions" on related_questions for select to authenticated using (true);

-- Seed known areas and professors from the inspected source files.
insert into law_areas (name) values
  ('Derecho Civil'),
  ('Derecho Constitucional'),
  ('Derecho Procesal'),
  ('Derecho Penal')
on conflict (name) do nothing;

insert into professors (name) values
  ('Felipe Ortiz'),
  ('Mauricio Figueroa'),
  ('Stephanie Merlet'),
  ('Felipe Ascencio'),
  ('Constanza Astudillo'),
  ('Fernando Orellana')
on conflict (name) do nothing;

-- Supabase Storage buckets. Policies are configured separately in Supabase UI or a later migration.
insert into storage.buckets (id, name, public) values
  ('source-documents', 'source-documents', false),
  ('answer-audios', 'answer-audios', false)
on conflict (id) do nothing;


