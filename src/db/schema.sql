-- =====================
-- SATAP ACADEMY SCHEMA
-- =====================

-- Extensions
create extension if not exists "uuid-ossp";

-- Profiles (auto-created on user signup)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text default '',
  avatar_url text default '',
  lang text default 'EN',
  plan_type text default 'free' check (plan_type in ('free', 'pro', 'enterprise')),
  exam_date date default null,
  role text default 'user' check (role in ('owner', 'admin', 'user')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Subjects
create table subjects (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  title text not null,
  description text default '',
  icon text default '',
  color text default '#000',
  order_index int default 0,
  created_at timestamptz default now()
);

-- Modules per subject
create table modules (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  description text default '',
  order_index int default 0,
  lesson_count int default 0,
  duration text default '',
  created_at timestamptz default now()
);

-- User progress per module
create table user_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  status text default 'locked' check (status in ('locked', 'available', 'started', 'completed')),
  score int default null,
  completed_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, module_id)
);

-- Topics per module
create table if not exists topics (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references modules(id) on delete cascade,
  title text not null,
  description text default '',
  order_index int default 0,
  created_at timestamptz default now()
);

-- User scores per subject
create table user_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  score int default 0,
  max_score int default 800,
  last_updated timestamptz default now(),
  unique(user_id, subject_id)
);

-- Overall SAT score
create table user_total_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  total_score int default 0,
  last_updated timestamptz default now()
);

-- Study plans
create table study_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  day_of_week int check (day_of_week between 0 and 6),
  time_slot text default '',
  subject text default '',
  activity text default '',
  duration text default '',
  notes text default '',
  priority int default 2 check (priority between 1 and 3),
  done boolean default false,
  created_at timestamptz default now()
);

-- Practice tests
create table practice_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  topic_id uuid,
  subject text default '',
  score int default 0,
  total int default 0,
  duration text default '',
  answers jsonb default null,
  taken_at timestamptz default now()
);

-- User activity log
create table user_activity (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  detail text default '',
  created_at timestamptz default now()
);

-- Login streaks (calendar)
create table login_streaks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  login_date date not null,
  created_at timestamptz default now(),
  unique(user_id, login_date)
);

-- Push notification subscriptions
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  subscription jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User settings
create table user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  email_notifications boolean default true,
  push_notifications boolean default true,
  reminder_time text default '10:00',
  show_profile boolean default true,
  two_factor boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================
-- ROW LEVEL SECURITY
-- =====================
alter table profiles enable row level security;
alter table user_progress enable row level security;
alter table topics enable row level security;
alter table user_scores enable row level security;
alter table user_total_scores enable row level security;
alter table study_plans enable row level security;
alter table practice_tests enable row level security;
alter table user_activity enable row level security;
alter table login_streaks enable row level security;
alter table push_subscriptions enable row level security;
alter table user_settings enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Subjects: public read
create policy "Anyone can view subjects"
  on subjects for select
  using (true);

-- Modules: public read
create policy "Anyone can view modules"
  on modules for select
  using (true);
drop policy if exists "Anyone can insert modules" on modules;
create policy "Anyone can insert modules" on modules for insert with check (true);
drop policy if exists "Anyone can update modules" on modules;
create policy "Anyone can update modules" on modules for update using (true);
drop policy if exists "Anyone can delete modules" on modules;
create policy "Anyone can delete modules" on modules for delete using (true);

-- Topics: public read
drop policy if exists "Anyone can view topics" on topics;
create policy "Anyone can view topics"
  on topics for select
  using (true);
drop policy if exists "Anyone can insert topics" on topics;
create policy "Anyone can insert topics" on topics for insert with check (true);
drop policy if exists "Anyone can update topics" on topics;
create policy "Anyone can update topics" on topics for update using (true);
drop policy if exists "Anyone can delete topics" on topics;
create policy "Anyone can delete topics" on topics for delete using (true);

-- User progress: own only
create policy "Users can view own progress"
  on user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on user_progress for update
  using (auth.uid() = user_id);

-- Scores: own only
create policy "Users can view own scores"
  on user_scores for select
  using (auth.uid() = user_id);

create policy "Users can upsert own scores"
  on user_scores for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scores"
  on user_scores for update
  using (auth.uid() = user_id);

-- Total scores: own only
create policy "Users can view own total score"
  on user_total_scores for select
  using (auth.uid() = user_id);

create policy "Users can upsert own total score"
  on user_total_scores for insert
  with check (auth.uid() = user_id);

create policy "Users can update own total score"
  on user_total_scores for update
  using (auth.uid() = user_id);

-- Study plans: own only
create policy "Users can view own study plans"
  on study_plans for select
  using (auth.uid() = user_id);

create policy "Users can manage own study plans"
  on study_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own study plans"
  on study_plans for update
  using (auth.uid() = user_id);

create policy "Users can delete own study plans"
  on study_plans for delete
  using (auth.uid() = user_id);

-- Practice tests: own only
create policy "Users can view own tests"
  on practice_tests for select
  using (auth.uid() = user_id);

create policy "Users can insert own tests"
  on practice_tests for insert
  with check (auth.uid() = user_id);

-- Activity: own only
create policy "Users can view own activity"
  on user_activity for select
  using (auth.uid() = user_id);

create policy "Users can insert own activity"
  on user_activity for insert
  with check (auth.uid() = user_id);

-- Login streaks: own only
create policy "Users can view own streaks"
  on login_streaks for select
  using (auth.uid() = user_id);

create policy "Users can insert own streaks"
  on login_streaks for insert
  with check (auth.uid() = user_id);

-- Push subscriptions: own only
create policy "Users can manage own push subscriptions"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);
create policy "Users can update own push subscriptions"
  on push_subscriptions for update
  using (auth.uid() = user_id);
create policy "Users can delete own push subscriptions"
  on push_subscriptions for delete
  using (auth.uid() = user_id);
create policy "Users can view own push subscriptions"
  on push_subscriptions for select
  using (auth.uid() = user_id);

-- Settings: own only
create policy "Users can view own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = user_id);

-- =====================
-- SEED DATA: Subjects + Modules
-- =====================
insert into subjects (slug, title, description, icon, color, order_index) values
  ('sat-math', 'SAT Math', 'Algebra, geometry, trigonometry, and data analysis', '📐', '#1a1a2e', 1),
  ('sat-rw', 'SAT Reading & Writing', 'Critical reading, grammar, and essay writing', '📖', '#16213e', 2),
  ('ap-bio', 'AP Biology', 'Cell biology, genetics, evolution, and ecology', '🧬', '#0f3460', 3),
  ('ap-calc', 'AP Calculus', 'Limits, derivatives, integrals, and series', '∫', '#533483', 4);

-- SAT Math modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Heart of Algebra', 'Linear equations, inequalities, and systems', 1, 8, '2 weeks' from subjects where slug = 'sat-math';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Problem Solving & Data Analysis', 'Ratios, percentages, statistics', 2, 6, '1.5 weeks' from subjects where slug = 'sat-math';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Passport to Advanced Math', 'Quadratic, exponential, and polynomial functions', 3, 8, '2 weeks' from subjects where slug = 'sat-math';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Additional Topics', 'Geometry, trigonometry, complex numbers', 4, 5, '1 week' from subjects where slug = 'sat-math';

-- SAT RW modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Reading Comprehension', 'Passage analysis and main idea identification', 1, 10, '2.5 weeks' from subjects where slug = 'sat-rw';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Writing & Language', 'Grammar, punctuation, and sentence structure', 2, 8, '2 weeks' from subjects where slug = 'sat-rw';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Essay Writing', 'Argumentative essay structure and rhetoric', 3, 5, '1 week' from subjects where slug = 'sat-rw';

-- AP Bio modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Cell Biology', 'Cell structure, membrane transport, cell division', 1, 8, '2 weeks' from subjects where slug = 'ap-bio';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Genetics', 'DNA replication, transcription, translation', 2, 6, '1.5 weeks' from subjects where slug = 'ap-bio';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Evolution & Ecology', 'Natural selection, ecosystems, biodiversity', 3, 7, '2 weeks' from subjects where slug = 'ap-bio';

-- AP Calc modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Limits & Continuity', 'Limit laws, continuity, asymptotes', 1, 6, '1.5 weeks' from subjects where slug = 'ap-calc';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Derivatives', 'Derivative rules, implicit differentiation, applications', 2, 10, '2.5 weeks' from subjects where slug = 'ap-calc';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Integrals', 'Integration techniques, definite integrals, area', 3, 8, '2 weeks' from subjects where slug = 'ap-calc';

-- =====================
-- TOPICS
-- =====================

-- SAT Math → Heart of Algebra
insert into topics (module_id, title, description, order_index)
select id, 'Linear Equations', 'Solving linear equations and inequalities', 1 from modules where title = 'Heart of Algebra' and not exists (select 1 from topics where title = 'Linear Equations');
insert into topics (module_id, title, description, order_index)
select id, 'Systems of Equations', 'Solving systems of linear equations', 2 from modules where title = 'Heart of Algebra' and not exists (select 1 from topics where title = 'Systems of Equations');

-- SAT Math → Problem Solving & Data Analysis
insert into topics (module_id, title, description, order_index)
select id, 'Ratios & Proportions', 'Ratios, rates, and proportional relationships', 1 from modules where title = 'Problem Solving & Data Analysis' and not exists (select 1 from topics where title = 'Ratios & Proportions');
insert into topics (module_id, title, description, order_index)
select id, 'Statistics', 'Mean, median, mode, and data interpretation', 2 from modules where title = 'Problem Solving & Data Analysis' and not exists (select 1 from topics where title = 'Statistics');

-- SAT Math → Passport to Advanced Math
insert into topics (module_id, title, description, order_index)
select id, 'Quadratics', 'Quadratic functions and equations', 1 from modules where title = 'Passport to Advanced Math' and not exists (select 1 from topics where title = 'Quadratics');
insert into topics (module_id, title, description, order_index)
select id, 'Polynomials', 'Polynomial operations and functions', 2 from modules where title = 'Passport to Advanced Math' and not exists (select 1 from topics where title = 'Polynomials');

-- SAT Math → Additional Topics
insert into topics (module_id, title, description, order_index)
select id, 'Geometry', 'Angles, triangles, circles, and area', 1 from modules where title = 'Additional Topics' and not exists (select 1 from topics where title = 'Geometry');
insert into topics (module_id, title, description, order_index)
select id, 'Trigonometry', 'Right triangle trig and the unit circle', 2 from modules where title = 'Additional Topics' and not exists (select 1 from topics where title = 'Trigonometry');

-- SAT RW → Reading Comprehension
insert into topics (module_id, title, description, order_index)
select id, 'Main Idea', 'Identifying central themes and purposes', 1 from modules where title = 'Reading Comprehension' and not exists (select 1 from topics where title = 'Main Idea');
insert into topics (module_id, title, description, order_index)
select id, 'Vocabulary in Context', 'Understanding word meanings in passages', 2 from modules where title = 'Reading Comprehension' and not exists (select 1 from topics where title = 'Vocabulary in Context');

-- SAT RW → Writing & Language
insert into topics (module_id, title, description, order_index)
select id, 'Grammar', 'Subject-verb agreement, tenses, punctuation', 1 from modules where title = 'Writing & Language' and not exists (select 1 from topics where title = 'Grammar');
insert into topics (module_id, title, description, order_index)
select id, 'Sentence Structure', 'Clauses, modifiers, and parallelism', 2 from modules where title = 'Writing & Language' and not exists (select 1 from topics where title = 'Sentence Structure');

-- AP Bio → Cell Biology
insert into topics (module_id, title, description, order_index)
select id, 'Cell Structure', 'Organelles and their functions', 1 from modules where title = 'Cell Biology' and not exists (select 1 from topics where title = 'Cell Structure');
insert into topics (module_id, title, description, order_index)
select id, 'Cell Division', 'Mitosis and meiosis', 2 from modules where title = 'Cell Biology' and not exists (select 1 from topics where title = 'Cell Division');

-- AP Bio → Genetics
insert into topics (module_id, title, description, order_index)
select id, 'DNA & RNA', 'Replication, transcription, translation', 1 from modules where title = 'Genetics' and not exists (select 1 from topics where title = 'DNA & RNA');
insert into topics (module_id, title, description, order_index)
select id, 'Mendelian Genetics', 'Punnett squares and inheritance patterns', 2 from modules where title = 'Genetics' and not exists (select 1 from topics where title = 'Mendelian Genetics');

-- AP Calc → Limits & Continuity
insert into topics (module_id, title, description, order_index)
select id, 'Limits', 'Limit laws and evaluating limits', 1 from modules where title = 'Limits & Continuity' and not exists (select 1 from topics where title = 'Limits');
insert into topics (module_id, title, description, order_index)
select id, 'Continuity', 'Continuity conditions and IVT', 2 from modules where title = 'Limits & Continuity' and not exists (select 1 from topics where title = 'Continuity');

-- AP Calc → Derivatives
insert into topics (module_id, title, description, order_index)
select id, 'Derivative Rules', 'Power, product, quotient, chain rule', 1 from modules where title = 'Derivatives' and not exists (select 1 from topics where title = 'Derivative Rules');
insert into topics (module_id, title, description, order_index)
select id, 'Applications', 'Related rates, optimization, curve sketching', 2 from modules where title = 'Derivatives' and not exists (select 1 from topics where title = 'Applications');

-- =====================
-- QUESTIONS
-- =====================
create table if not exists questions (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  question_text text not null,
  options jsonb not null,
  correct_index int not null,
  image_url text default '',
  explanation text default '',
  order_index int default 0,
  question_type text default 'multiple_choice' check (question_type in ('multiple_choice', 'written')),
  created_at timestamptz default now()
);

alter table questions enable row level security;
drop policy if exists "Anyone can view questions" on questions;
create policy "Anyone can view questions" on questions for select using (true);
drop policy if exists "Anyone can insert questions" on questions;
create policy "Anyone can insert questions" on questions for insert with check (true);
drop policy if exists "Anyone can update questions" on questions;
create policy "Anyone can update questions" on questions for update using (true);
drop policy if exists "Anyone can delete questions" on questions;
create policy "Anyone can delete questions" on questions for delete using (true);

-- Seed questions for SAT Math
insert into questions (subject_id, question_text, options, correct_index)
select id, 'If 3x + 7 = 22, what is the value of x?', '["3","5","7","9"]'::jsonb, 1
from subjects where slug = 'sat-math' and not exists (select 1 from questions);

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the slope of the line y = 2x + 3?', '["1","2","3","-2"]'::jsonb, 1
from subjects where slug = 'sat-math' and not exists (select 1 from questions where question_text like 'What is the slope%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'If a rectangle has length 8 and width 5, what is its area?', '["13","26","40","80"]'::jsonb, 2
from subjects where slug = 'sat-math' and not exists (select 1 from questions where question_text like 'If a rectangle%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is 15% of 200?', '["15","20","30","35"]'::jsonb, 2
from subjects where slug = 'sat-math' and not exists (select 1 from questions where question_text like 'What is 15%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'Simplify: (x²)(x³)', '["x⁵","x⁶","2x⁵","x"]'::jsonb, 0
from subjects where slug = 'sat-math' and not exists (select 1 from questions where question_text like 'Simplify:%');

-- Seed questions for SAT RW
insert into questions (subject_id, question_text, options, correct_index)
select id, 'Choose the correct word: The professor was ___ for his groundbreaking research.', '["renowned","renounced","announced","denounced"]'::jsonb, 0
from subjects where slug = 'sat-rw' and not exists (select 1 from questions where question_text like 'Choose the correct word%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'The author''s tone in the passage can best be described as:', '["critical","supportive","neutral","sarcastic"]'::jsonb, 1
from subjects where slug = 'sat-rw' and not exists (select 1 from questions where question_text like 'The author''s tone%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'Which sentence is grammatically correct?', '["He go to school every day","He goes to school every day","He going to school every day","He went to school every day"]'::jsonb, 1
from subjects where slug = 'sat-rw' and not exists (select 1 from questions where question_text like 'Which sentence is grammatically%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'The word "benevolent" most nearly means:', '["cruel","generous","angry","quick"]'::jsonb, 1
from subjects where slug = 'sat-rw' and not exists (select 1 from questions where question_text like 'The word benevolent%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the main purpose of a thesis statement?', '["To entertain","To introduce the main argument","To conclude the essay","To provide evidence"]'::jsonb, 1
from subjects where slug = 'sat-rw' and not exists (select 1 from questions where question_text like 'What is the main purpose%');

-- Seed questions for AP Bio
insert into questions (subject_id, question_text, options, correct_index)
select id, 'What organelle is responsible for protein synthesis?', '["Mitochondria","Ribosome","Nucleus","Golgi apparatus"]'::jsonb, 1
from subjects where slug = 'ap-bio' and not exists (select 1 from questions where question_text like 'What organelle%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'DNA replication occurs during which phase of the cell cycle?', '["G1","S","G2","M"]'::jsonb, 1
from subjects where slug = 'ap-bio' and not exists (select 1 from questions where question_text like 'DNA replication%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the primary function of mitochondria?', '["Protein synthesis","Energy production","Lipid storage","DNA replication"]'::jsonb, 1
from subjects where slug = 'ap-bio' and not exists (select 1 from questions where question_text like 'What is the primary function of mitochondria%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'Which of the following is a prokaryote?', '["Human cell","Bacteria","Plant cell","Fungi"]'::jsonb, 1
from subjects where slug = 'ap-bio' and not exists (select 1 from questions where question_text like 'Which of the following is a prokaryote%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'Photosynthesis takes place in the:', '["Mitochondria","Chloroplast","Nucleus","Ribosome"]'::jsonb, 1
from subjects where slug = 'ap-bio' and not exists (select 1 from questions where question_text like 'Photosynthesis takes place%');

-- Seed questions for AP Calc
insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the derivative of x²?', '["x","2x","2","x²"]'::jsonb, 1
from subjects where slug = 'ap-calc' and not exists (select 1 from questions where question_text like 'What is the derivative of x²%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the limit of 1/x as x approaches infinity?', '["1","Infinity","0","-1"]'::jsonb, 2
from subjects where slug = 'ap-calc' and not exists (select 1 from questions where question_text like 'What is the limit%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'The integral of 2x dx is:', '["x² + C","2 + C","x + C","2x² + C"]'::jsonb, 0
from subjects where slug = 'ap-calc' and not exists (select 1 from questions where question_text like 'The integral of 2x%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the derivative of sin(x)?', '["cos(x)","-sin(x)","tan(x)","-cos(x)"]'::jsonb, 0
from subjects where slug = 'ap-calc' and not exists (select 1 from questions where question_text like 'What is the derivative of sin%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'If f(x) = 3x + 2, what is f(x)?', '["3x","3","2","3x + 2"]'::jsonb, 1
from subjects where slug = 'ap-calc' and not exists (select 1 from questions where question_text like 'If f(x) = 3x%');

-- =====================
-- QUESTIONS PER TOPIC
-- =====================

-- Linear Equations (SAT Math)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'If 3x + 7 = 22, what is the value of x?', '["3","5","7","9"]'::jsonb, 1, 'Subtract 7 from both sides: 3x = 15, then divide by 3: x = 5', 1
from subjects s, topics t where s.slug = 'sat-math' and t.title = 'Linear Equations' and not exists (select 1 from questions where question_text like 'If 3x + 7 = 22%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Solve: 2(x - 3) = 12', '["x = 3","x = 6","x = 9","x = 12"]'::jsonb, 2, '2x - 6 = 12 → 2x = 18 → x = 9', 2
from subjects s, topics t where s.slug = 'sat-math' and t.title = 'Linear Equations' and not exists (select 1 from questions where question_text like 'Solve: 2(x - 3) = 12%');

-- Quadratics (SAT Math)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What are the solutions to x² - 5x + 6 = 0?', '["x = 2, 3","x = -2, -3","x = 1, 6","x = -1, -6"]'::jsonb, 0, '(x - 2)(x - 3) = 0 → x = 2 or x = 3', 1
from subjects s, topics t where s.slug = 'sat-math' and t.title = 'Quadratics' and not exists (select 1 from questions where question_text like 'What are the solutions to x² - 5x%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the vertex of y = x² - 4x + 3?', '["(2, -1)","(-2, 3)","(4, 3)","(0, 3)"]'::jsonb, 0, 'Vertex x = -b/2a = 2, y = 4 - 8 + 3 = -1', 2
from subjects s, topics t where s.slug = 'sat-math' and t.title = 'Quadratics' and not exists (select 1 from questions where question_text like 'What is the vertex of y = x²%');

-- Geometry (SAT Math)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'A triangle has sides 3, 4, and 5. What is its area?', '["6","12","15","20"]'::jsonb, 0, 'It''s a right triangle. Area = ½ × 3 × 4 = 6', 1
from subjects s, topics t where s.slug = 'sat-math' and t.title = 'Geometry' and not exists (select 1 from questions where question_text like 'A triangle has sides 3, 4, and 5%');

-- Grammar (SAT RW)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Choose the correct form: Neither the teacher nor the students ___ aware of the change.', '["was","were","is","are"]'::jsonb, 1, 'With "neither...nor", the verb agrees with the closer subject (students → were)', 1
from subjects s, topics t where s.slug = 'sat-rw' and t.title = 'Grammar' and not exists (select 1 from questions where question_text like 'Neither the teacher nor the students%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Which sentence is correct?', '["He go to school yesterday","He goes to school yesterday","He went to school yesterday","He going to school yesterday"]'::jsonb, 2, 'Past tense requires "went"', 2
from subjects s, topics t where s.slug = 'sat-rw' and t.title = 'Grammar' and not exists (select 1 from questions where question_text like 'He go to school yesterday%');

-- Main Idea (SAT RW)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'The author''s primary purpose is to:', '["entertain","inform","persuade","criticize"]'::jsonb, 1, 'The passage presents factual information objectively', 1
from subjects s, topics t where s.slug = 'sat-rw' and t.title = 'Main Idea' and not exists (select 1 from questions where question_text like 'The author''s primary purpose is to:%');

-- Cell Structure (AP Bio)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Which organelle is the site of ATP production?', '["Nucleus","Ribosome","Mitochondria","Golgi"]'::jsonb, 2, 'Mitochondria are the powerhouses of the cell', 1
from subjects s, topics t where s.slug = 'ap-bio' and t.title = 'Cell Structure' and not exists (select 1 from questions where question_text like 'Which organelle is the site of ATP%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the function of the Golgi apparatus?', '["Protein synthesis","Energy production","Packaging and transport","DNA replication"]'::jsonb, 2, 'The Golgi modifies, sorts, and packages proteins', 2
from subjects s, topics t where s.slug = 'ap-bio' and t.title = 'Cell Structure' and not exists (select 1 from questions where question_text like 'What is the function of the Golgi%');

-- Limits (AP Calc)
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the limit of (x² - 1)/(x - 1) as x approaches 1?', '["0","1","2","undefined"]'::jsonb, 2, 'Factor: (x-1)(x+1)/(x-1) = x+1 → limit = 2', 1
from subjects s, topics t where s.slug = 'ap-calc' and t.title = 'Limits' and not exists (select 1 from questions where question_text like 'What is the limit of (x² - 1)%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is lim(x→0) sin(x)/x?', '["0","1","π","undefined"]'::jsonb, 1, 'This is a fundamental trigonometric limit = 1', 2
from subjects s, topics t where s.slug = 'ap-calc' and t.title = 'Limits' and not exists (select 1 from questions where question_text like 'What is lim(x→0) sin(x)/x%');

-- =====================
-- STORAGE POLICIES
-- =====================

-- Create avav2 bucket (run in Supabase Dashboard Storage section)
-- Name: avav2, Public bucket: ON

-- Allow users to upload their own avatar
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (bucket_id = 'avav2' and auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own avatar
create policy "Users can update their own avatar"
on storage.objects for update
using (bucket_id = 'avav2' and auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public to view avatars
create policy "Public can view avatars"
on storage.objects for select
using (bucket_id = 'avav2');
