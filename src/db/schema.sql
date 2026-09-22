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
  is_active boolean default true,
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

-- Full SAT Tests
create table sat_tests (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  subject_id uuid references subjects(id),
  pdf_url text default '',
  total_questions int default 0,
  created_at timestamptz default now()
);

create table sat_modules (
  id uuid default gen_random_uuid() primary key,
  test_id uuid references sat_tests(id) on delete cascade,
  name text not null,
  section text not null,
  module_number int not null,
  question_count int default 0,
  order_index int default 0
);

create table sat_questions (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references sat_modules(id) on delete cascade,
  question_number int not null,
  question_text text not null,
  options jsonb default '[]',
  correct_index int default 0,
  explanation text default '',
  image_url text default ''
);

alter table sat_tests enable row level security;
alter table sat_modules enable row level security;
alter table sat_questions enable row level security;

create policy "Anyone can view SAT tests"
  on sat_tests for select using (true);
create policy "Admins can insert/update/delete SAT tests"
  on sat_tests for all using (auth.uid() in (select id from profiles where role in ('admin','owner')));
create policy "Anyone can view SAT modules"
  on sat_modules for select using (true);
create policy "Admins can manage SAT modules"
  on sat_modules for all using (auth.uid() in (select id from profiles where role in ('admin','owner')));
create policy "Anyone can view SAT questions"
  on sat_questions for select using (true);
create policy "Admins can manage SAT questions"
  on sat_questions for all using (auth.uid() in (select id from profiles where role in ('admin','owner')));

-- Practice tests
create table practice_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
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





-- User settings
create table user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
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
alter table user_scores enable row level security;
alter table user_total_scores enable row level security;
alter table study_plans enable row level security;
alter table practice_tests enable row level security;
alter table user_activity enable row level security;
alter table login_streaks enable row level security;

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

-- Settings: own only
create policy "Users can view own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

-- =====================
-- SEED DATA: Subjects + Modules
-- =====================
insert into subjects (slug, title, description, icon, color, order_index) values
  ('advanced-math', 'Advanced Math', 'Quadratics, exponentials, logarithms, and advanced equations', '🧮', '#059669', 1),
  ('algebra', 'Algebra', 'Equations, inequalities, functions, and polynomials', '∑', '#7c3aed', 2),
  ('geometry', 'Geometry', 'Angles, shapes, area, volume, and proofs', '△', '#0ea5e9', 3),
  ('data-analysis', 'Data Analysis', 'Statistics, probability, and data interpretation', '📊', '#d97706', 4),
  ('problem-solving', 'Problem Solving', 'Ratios, word problems, estimation, and logic', '🧩', '#db2777', 5);

-- Advanced Math modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Quadratic Functions', 'Solving quadratics and parabola graphs', 1, 6, '1.5 weeks' from subjects where slug = 'advanced-math';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Advanced Equations', 'Rational and radical equations', 2, 6, '1.5 weeks' from subjects where slug = 'advanced-math';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Exponentials & Logarithms', 'Exponential growth and log basics', 3, 6, '1.5 weeks' from subjects where slug = 'advanced-math';

-- Algebra modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Expressions & Equations', 'Simplifying expressions and solving equations', 1, 6, '1.5 weeks' from subjects where slug = 'algebra';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Functions & Graphs', 'Function notation and graphing lines', 2, 6, '1.5 weeks' from subjects where slug = 'algebra';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Factoring & Polynomials', 'Factoring techniques and polynomial operations', 3, 6, '1.5 weeks' from subjects where slug = 'algebra';

-- Geometry modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Angles & Triangles', 'Angle relationships and triangle properties', 1, 6, '1.5 weeks' from subjects where slug = 'geometry';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Circles & Measurement', 'Circles, area, and perimeter', 2, 6, '1.5 weeks' from subjects where slug = 'geometry';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Solid & Coordinate Geometry', 'Volume, surface area, and the coordinate plane', 3, 6, '1.5 weeks' from subjects where slug = 'geometry';

-- Data Analysis modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Descriptive Statistics', 'Averages, spread, and distributions', 1, 6, '1.5 weeks' from subjects where slug = 'data-analysis';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Probability', 'Basic and conditional probability', 2, 6, '1.5 weeks' from subjects where slug = 'data-analysis';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Data Interpretation', 'Tables, charts, and scatterplots', 3, 6, '1.5 weeks' from subjects where slug = 'data-analysis';

-- Problem Solving modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Ratios & Rates', 'Unit rates and percent problems', 1, 6, '1.5 weeks' from subjects where slug = 'problem-solving';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Word Problems', 'Age, motion, and work problems', 2, 6, '1.5 weeks' from subjects where slug = 'problem-solving';

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Estimation & Logic', 'Estimation strategies and logical reasoning', 3, 6, '1.5 weeks' from subjects where slug = 'problem-solving';

-- QUESTIONS
-- =====================
create table if not exists questions (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard', 'elite', 'mixing')),
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

-- Seed questions for Advanced Math
insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is i²?', '["1","-1","i","0"]'::jsonb, 1
from subjects where slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'What is i²%');

-- Seed questions for Data Analysis
insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the range of {4, 9, 2, 7}?', '["5","6","7","9"]'::jsonb, 2
from subjects where slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'What is the range of {4, 9, 2, 7}%');

-- Seed questions for Problem Solving
insert into questions (subject_id, question_text, options, correct_index)
select id, 'A train travels 120 km in 2 hours. What is its speed?', '["40","50","60","80"]'::jsonb, 2
from subjects where slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'A train travels 120 km%');

-- Seed questions for Algebra
insert into questions (subject_id, question_text, options, correct_index)
select id, 'Solve for x: 4x + 9 = 25', '["2","4","6","8"]'::jsonb, 1
from subjects where slug = 'algebra' and not exists (select 1 from questions where question_text like 'Solve for x: 4x + 9%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'If 2(x + 3) = 16, what is x?', '["3","5","8","13"]'::jsonb, 1
from subjects where slug = 'algebra' and not exists (select 1 from questions where question_text like 'If 2(x + 3) = 16%');

-- Seed questions for Geometry
insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the sum of the interior angles of a pentagon?', '["360°","540°","720°","900°"]'::jsonb, 1
from subjects where slug = 'geometry' and not exists (select 1 from questions where question_text like 'What is the sum of the interior angles of a pentagon%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'A square has side length 9. What is its perimeter?', '["18","27","36","81"]'::jsonb, 2
from subjects where slug = 'geometry' and not exists (select 1 from questions where question_text like 'A square has side length 9%');

-- =====================
-- QUESTIONS PER TOPIC
-- =====================

-- Solving Quadratics (Advanced Math)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Solve: x² - 9 = 0', '["3","-3","±3","9"]'::jsonb, 2, 'x² = 9 → x = ±3', 1
from subjects s where s.slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'Solve: x² - 9 = 0%');

-- Parabolas & Vertex (Advanced Math)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the vertex of y = (x - 1)² + 2?', '["(1, 2)","(-1, 2)","(1, -2)","(0, 2)"]'::jsonb, 0, 'Vertex form y = (x - h)² + k → (1, 2)', 1
from subjects s where s.slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'What is the vertex of y = (x - 1)%');

-- Rational Equations (Advanced Math)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Solve: 2/x = 4', '["2","1/2","8","4"]'::jsonb, 1, '2 = 4x → x = 1/2', 1
from subjects s where s.slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'Solve: 2/x = 4%');

-- Radical Equations (Advanced Math)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Solve: √(x + 5) = 3', '["2","4","9","14"]'::jsonb, 1, 'Square both sides: x + 5 = 9 → x = 4', 1
from subjects s where s.slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'Solve: √(x + 5) = 3%');

-- Exponential Growth (Advanced Math)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'A population of 50 doubles every year. How many after 3 years?', '["150","200","400","800"]'::jsonb, 2, '50 × 2³ = 400', 1
from subjects s where s.slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'A population of 50 doubles%');

-- Logarithm Basics (Advanced Math)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is log₁₀(1000)?', '["2","3","10","100"]'::jsonb, 1, '10³ = 1000 → log = 3', 1
from subjects s where s.slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'What is log₁₀(1000)%');

-- Mean, Median & Mode (Data Analysis)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the mode of {2, 3, 3, 5, 7}?', '["2","3","5","7"]'::jsonb, 1, '3 appears most often', 1
from subjects s where s.slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'What is the mode of {2, 3, 3, 5, 7}%');

-- Spread & Box Plots (Data Analysis)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What does the IQR describe?', '["Average","Middle 50% spread","Maximum","Total range"]'::jsonb, 1, 'IQR = middle 50% of the data', 1
from subjects s where s.slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'What does the IQR describe%');

-- Basic Probability (Data Analysis)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'A bag has 3 red and 2 blue marbles. What is P(red)?', '["1/2","3/5","2/5","1/3"]'::jsonb, 1, '3 favorable out of 5 total', 1
from subjects s where s.slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'A bag has 3 red and 2 blue marbles%');

-- Conditional Probability (Data Analysis)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'P(A|B) means the probability of:', '["A and B","A given B","A or B","Not A"]'::jsonb, 1, 'Vertical bar reads as "given"', 1
from subjects s where s.slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'P(A|B) means%');

-- Tables & Charts (Data Analysis)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'In a pie chart, what percent is one quarter?', '["20%","25%","50%","75%"]'::jsonb, 1, '100% ÷ 4 = 25%', 1
from subjects s where s.slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'In a pie chart, what percent is one quarter%');

-- Scatterplots & Trend (Data Analysis)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'A downward-trending scatterplot shows what correlation?', '["Positive","Negative","Zero","Perfect"]'::jsonb, 1, 'As x rises, y falls → negative', 1
from subjects s where s.slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'A downward-trending scatterplot%');

-- Unit Rates (Problem Solving)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'If 4 apples cost $2, what is the unit price?', '["$0.25","$0.50","$2.00","$8.00"]'::jsonb, 1, '2 ÷ 4 = $0.50 per apple', 1
from subjects s where s.slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'If 4 apples cost $2%');

-- Percent Problems (Problem Solving)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is 20% of 150?', '["20","25","30","35"]'::jsonb, 2, '0.20 × 150 = 30', 1
from subjects s where s.slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'What is 20% of 150%');

-- Age & Motion Problems (Problem Solving)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Ali is 3 times as old as Vali. Their ages sum to 24. How old is Ali?', '["6","8","12","18"]'::jsonb, 3, '3x + x = 24 → x = 6 → Ali is 18', 1
from subjects s where s.slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'Ali is 3 times as old%');

-- Work Problems (Problem Solving)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'A tap fills a tank in 6 hours. What fraction is filled in 2 hours?', '["1/6","1/3","1/2","2/3"]'::jsonb, 1, 'Rate = 1/6 per hour → 2/6 = 1/3', 1
from subjects s where s.slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'A tap fills a tank in 6 hours%');

-- Estimation Strategies (Problem Solving)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Estimate 49 × 21', '["600","800","1000","1200"]'::jsonb, 2, 'Round: 50 × 20 = 1000', 1
from subjects s where s.slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'Estimate 49 × 21%');

-- Logical Reasoning (Problem Solving)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'All squares are rectangles. Figure X is a square. So X is a:', '["square","rectangle","circle","triangle"]'::jsonb, 1, 'Every square belongs to the rectangle family', 1
from subjects s where s.slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'All squares are rectangles%');

-- Evaluating Expressions (Algebra)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'If x = 3 and y = -2, what is the value of 2x + 3y?', '["0","1","-1","12"]'::jsonb, 0, '2(3) + 3(-2) = 6 - 6 = 0', 1
from subjects s where s.slug = 'algebra' and not exists (select 1 from questions where question_text like 'If x = 3 and y = -2%');

-- Solving Inequalities (Algebra)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Solve: 5x - 3 > 12', '["x > 3","x < 3","x > 2","x < 2"]'::jsonb, 0, '5x > 15 → x > 3', 1
from subjects s where s.slug = 'algebra' and not exists (select 1 from questions where question_text like 'Solve: 5x - 3 > 12%');

-- Function Notation (Algebra)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'If f(x) = 2x - 5, what is f(4)?', '["3","8","13","-3"]'::jsonb, 0, 'f(4) = 2(4) - 5 = 3', 1
from subjects s where s.slug = 'algebra' and not exists (select 1 from questions where question_text like 'If f(x) = 2x - 5%');

-- Graphing Lines (Algebra)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the y-intercept of y = -3x + 7?', '["-3","7","3","-7"]'::jsonb, 1, 'In y = mx + b, b = 7 is the y-intercept', 1
from subjects s where s.slug = 'algebra' and not exists (select 1 from questions where question_text like 'What is the y-intercept of y = -3x%');

-- Factoring Quadratics (Algebra)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Factor: x² + 7x + 12', '["(x+3)(x+4)","(x+2)(x+6)","(x+1)(x+12)","(x-3)(x-4)"]'::jsonb, 0, 'Find two numbers with product 12 and sum 7: 3 and 4', 1
from subjects s where s.slug = 'algebra' and not exists (select 1 from questions where question_text like 'Factor: x² + 7x + 12%');

-- Polynomial Operations (Algebra)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Add: (3x² + 2x - 1) + (x² - 5x + 4)', '["4x² - 3x + 3","4x² + 7x + 3","2x² - 3x + 3","4x² - 3x - 5"]'::jsonb, 0, 'Combine like terms: 4x² - 3x + 3', 1
from subjects s where s.slug = 'algebra' and not exists (select 1 from questions where question_text like 'Add: (3x² + 2x - 1)%');

-- Angle Relationships (Geometry)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Two angles are complementary. If one is 35°, what is the other?', '["45°","55°","145°","125°"]'::jsonb, 1, 'Complementary angles sum to 90° → 90 - 35 = 55', 1
from subjects s where s.slug = 'geometry' and not exists (select 1 from questions where question_text like 'Two angles are complementary%');

-- Triangle Congruence (Geometry)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'Which postulate proves congruence when three sides are equal?', '["SAS","ASA","SSS","AAS"]'::jsonb, 2, 'Side-Side-Side (SSS) proves congruence', 1
from subjects s where s.slug = 'geometry' and not exists (select 1 from questions where question_text like 'Which postulate proves congruence%');

-- Circle Theorems (Geometry)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the circumference of a circle with radius 5?', '["5π","10π","25π","20π"]'::jsonb, 1, 'C = 2πr = 2π(5) = 10π', 1
from subjects s where s.slug = 'geometry' and not exists (select 1 from questions where question_text like 'What is the circumference of a circle with radius 5%');

-- Area & Perimeter (Geometry)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the area of a trapezoid with bases 6 and 10, height 4?', '["28","32","40","20"]'::jsonb, 1, 'A = (6+10)/2 × 4 = 32', 1
from subjects s where s.slug = 'geometry' and not exists (select 1 from questions where question_text like 'What is the area of a trapezoid%');

-- Volume & Surface Area (Geometry)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the volume of a cube with side length 4?', '["16","48","64","24"]'::jsonb, 2, 'V = s³ = 4³ = 64', 1
from subjects s where s.slug = 'geometry' and not exists (select 1 from questions where question_text like 'What is the volume of a cube%');

-- Coordinate Geometry (Geometry)
insert into questions (subject_id, difficulty, question_text, options, correct_index, explanation, order_index)
select s.id, 'medium', 'What is the distance between (0, 0) and (3, 4)?', '["3","4","5","7"]'::jsonb, 2, 'd = √(3² + 4²) = 5', 1
from subjects s where s.slug = 'geometry' and not exists (select 1 from questions where question_text like 'What is the distance between (0, 0)%');

-- =====================
-- QUESTIONS — FULL COVERAGE (every topic gets at least 1 question)
-- =====================

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

-- Add passage_text and layout columns for split writing questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage_text text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS layout text default 'centered';

-- =====================
-- USER SETTINGS EXTRAS
-- =====================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weekly_digest boolean default false;

-- =====================
-- ADMIN RPC FUNCTIONS
-- =====================

-- List all profiles with auth emails (owner/admin only)
create or replace function get_all_profiles()
returns table (
  id uuid,
  display_name text,
  email text,
  role text,
  plan_type text,
  created_at timestamptz
)
language plpgsql security definer stable
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.plan_type, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- List all practice tests across users (owner/admin only)
create or replace function get_all_practice_tests()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  title text,
  subject text,
  score int,
  total int,
  taken_at timestamptz
)
language plpgsql security definer stable
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select t.id, t.user_id, coalesce(p.display_name, '')::text, t.title, t.subject, t.score, t.total, t.taken_at
    from public.practice_tests t
    left join public.profiles p on p.id = t.user_id
    order by t.taken_at desc;
end;
$$;

-- Change a user's role (only owner/admin can call)
create or replace function set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql security definer
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('owner','admin')) then
    raise exception 'Not authorized';
  end if;
  if new_role not in ('user','admin','owner') then
    raise exception 'Invalid role';
  end if;
  update public.profiles set role = new_role, updated_at = now()
  where id = target_user_id;
end;
$$;

-- =====================
-- STORAGE BUCKET
-- =====================

-- Create avav2 bucket (used for avatars and question images)
insert into storage.buckets (id, name, public)
values ('avav2', 'avav2', true)
on conflict (id) do nothing;

-- =====================
-- VIDEO LESSONS (STUDY section)
-- =====================
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references topics(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  description text default '',
  video_url text not null,
  video_type text default 'youtube' check (video_type in ('youtube', 'file')),
  thumbnail_url text default '',
  order_index int default 0,
  created_at timestamptz default now()
);

alter table videos enable row level security;

drop policy if exists "Anyone can view videos" on videos;
create policy "Anyone can view videos"
  on videos for select using (true);

drop policy if exists "Admins can manage videos" on videos;
create policy "Admins can manage videos"
  on videos for all using (auth.uid() in (select id from profiles where role in ('admin','owner')));
