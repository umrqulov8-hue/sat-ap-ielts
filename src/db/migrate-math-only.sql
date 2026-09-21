-- =====================
-- MIGRATION: MATH-ONLY (SAT MATH + ALGEBRA + GEOMETRY)
-- Removes sat-rw / ap-bio / ap-calc and their content,
-- adds algebra + geometry tracks with starter content.
-- Re-runnable (all inserts guarded).
-- =====================

-- 1. Remove practice tests tied to removed subjects
delete from practice_tests
where topic_id in (
  select t.id from topics t
  join modules m on m.id = t.module_id
  join subjects s on s.id = m.subject_id
  where s.slug in ('sat-rw', 'ap-bio', 'ap-calc')
);
delete from practice_tests
where subject in ('SAT Reading & Writing', 'AP Biology', 'AP Calculus');

-- 2. Remove scores for removed subjects (cascade would also handle this)
delete from user_scores
where subject_id in (select id from subjects where slug in ('sat-rw', 'ap-bio', 'ap-calc'));

-- 3. Remove old subjects (cascades modules, topics, questions, progress)
delete from subjects where slug in ('sat-rw', 'ap-bio', 'ap-calc');

-- 4. New subjects
insert into subjects (slug, title, description, icon, color, order_index) values
  ('algebra', 'Algebra', 'Equations, inequalities, functions, and polynomials', '∑', '#7c3aed', 2),
  ('geometry', 'Geometry', 'Angles, shapes, area, volume, and proofs', '△', '#0ea5e9', 3)
on conflict (slug) do nothing;

-- 5. Algebra modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Expressions & Equations', 'Simplifying expressions and solving equations', 1, 6, '1.5 weeks'
from subjects where slug = 'algebra'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Expressions & Equations' and s.slug = 'algebra');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Functions & Graphs', 'Function notation and graphing lines', 2, 6, '1.5 weeks'
from subjects where slug = 'algebra'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Functions & Graphs' and s.slug = 'algebra');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Factoring & Polynomials', 'Factoring techniques and polynomial operations', 3, 6, '1.5 weeks'
from subjects where slug = 'algebra'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Factoring & Polynomials' and s.slug = 'algebra');

-- 6. Geometry modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Angles & Triangles', 'Angle relationships and triangle properties', 1, 6, '1.5 weeks'
from subjects where slug = 'geometry'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Angles & Triangles' and s.slug = 'geometry');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Circles & Measurement', 'Circles, area, and perimeter', 2, 6, '1.5 weeks'
from subjects where slug = 'geometry'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Circles & Measurement' and s.slug = 'geometry');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Solid & Coordinate Geometry', 'Volume, surface area, and the coordinate plane', 3, 6, '1.5 weeks'
from subjects where slug = 'geometry'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Solid & Coordinate Geometry' and s.slug = 'geometry');

-- 7. Algebra topics
insert into topics (module_id, title, description, order_index)
select id, 'Evaluating Expressions', 'Substitute values and simplify', 1 from modules where title = 'Expressions & Equations' and not exists (select 1 from topics where title = 'Evaluating Expressions');
insert into topics (module_id, title, description, order_index)
select id, 'Solving Inequalities', 'Linear inequalities and number lines', 2 from modules where title = 'Expressions & Equations' and not exists (select 1 from topics where title = 'Solving Inequalities');
insert into topics (module_id, title, description, order_index)
select id, 'Function Notation', 'Evaluating f(x) and domain basics', 1 from modules where title = 'Functions & Graphs' and not exists (select 1 from topics where title = 'Function Notation');
insert into topics (module_id, title, description, order_index)
select id, 'Graphing Lines', 'Slope, intercepts, and equations of lines', 2 from modules where title = 'Functions & Graphs' and not exists (select 1 from topics where title = 'Graphing Lines');
insert into topics (module_id, title, description, order_index)
select id, 'Factoring Quadratics', 'Factor trinomials and special products', 1 from modules where title = 'Factoring & Polynomials' and not exists (select 1 from topics where title = 'Factoring Quadratics');
insert into topics (module_id, title, description, order_index)
select id, 'Polynomial Operations', 'Add, subtract, and multiply polynomials', 2 from modules where title = 'Factoring & Polynomials' and not exists (select 1 from topics where title = 'Polynomial Operations');

-- 8. Geometry topics
insert into topics (module_id, title, description, order_index)
select id, 'Angle Relationships', 'Complementary, supplementary, and vertical angles', 1 from modules where title = 'Angles & Triangles' and not exists (select 1 from topics where title = 'Angle Relationships');
insert into topics (module_id, title, description, order_index)
select id, 'Triangle Congruence', 'SSS, SAS, ASA, and AAS postulates', 2 from modules where title = 'Angles & Triangles' and not exists (select 1 from topics where title = 'Triangle Congruence');
insert into topics (module_id, title, description, order_index)
select id, 'Circle Theorems', 'Circumference, arcs, and central angles', 1 from modules where title = 'Circles & Measurement' and not exists (select 1 from topics where title = 'Circle Theorems');
insert into topics (module_id, title, description, order_index)
select id, 'Area & Perimeter', 'Polygons, trapezoids, and composite shapes', 2 from modules where title = 'Circles & Measurement' and not exists (select 1 from topics where title = 'Area & Perimeter');
insert into topics (module_id, title, description, order_index)
select id, 'Volume & Surface Area', 'Prisms, cylinders, cones, and spheres', 1 from modules where title = 'Solid & Coordinate Geometry' and not exists (select 1 from topics where title = 'Volume & Surface Area');
insert into topics (module_id, title, description, order_index)
select id, 'Coordinate Geometry', 'Distance, midpoint, and slope on the plane', 2 from modules where title = 'Solid & Coordinate Geometry' and not exists (select 1 from topics where title = 'Coordinate Geometry');

-- 9. Algebra questions
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'If x = 3 and y = -2, what is the value of 2x + 3y?', '["0","1","-1","12"]'::jsonb, 0, '2(3) + 3(-2) = 6 - 6 = 0', 1
from subjects s, topics t where s.slug = 'algebra' and t.title = 'Evaluating Expressions' and not exists (select 1 from questions where question_text like 'If x = 3 and y = -2%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Solve: 5x - 3 > 12', '["x > 3","x < 3","x > 2","x < 2"]'::jsonb, 0, '5x > 15 → x > 3', 1
from subjects s, topics t where s.slug = 'algebra' and t.title = 'Solving Inequalities' and not exists (select 1 from questions where question_text like 'Solve: 5x - 3 > 12%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'If f(x) = 2x - 5, what is f(4)?', '["3","8","13","-3"]'::jsonb, 0, 'f(4) = 2(4) - 5 = 3', 1
from subjects s, topics t where s.slug = 'algebra' and t.title = 'Function Notation' and not exists (select 1 from questions where question_text like 'If f(x) = 2x - 5%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the y-intercept of y = -3x + 7?', '["-3","7","3","-7"]'::jsonb, 1, 'In y = mx + b, b = 7 is the y-intercept', 1
from subjects s, topics t where s.slug = 'algebra' and t.title = 'Graphing Lines' and not exists (select 1 from questions where question_text like 'What is the y-intercept of y = -3x%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Factor: x² + 7x + 12', '["(x+3)(x+4)","(x+2)(x+6)","(x+1)(x+12)","(x-3)(x-4)"]'::jsonb, 0, 'Find two numbers with product 12 and sum 7: 3 and 4', 1
from subjects s, topics t where s.slug = 'algebra' and t.title = 'Factoring Quadratics' and not exists (select 1 from questions where question_text like 'Factor: x² + 7x + 12%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Add: (3x² + 2x - 1) + (x² - 5x + 4)', '["4x² - 3x + 3","4x² + 7x + 3","2x² - 3x + 3","4x² - 3x - 5"]'::jsonb, 0, 'Combine like terms: 4x² - 3x + 3', 1
from subjects s, topics t where s.slug = 'algebra' and t.title = 'Polynomial Operations' and not exists (select 1 from questions where question_text like 'Add: (3x² + 2x - 1)%');

-- 10. Geometry questions
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Two angles are complementary. If one is 35°, what is the other?', '["45°","55°","145°","125°"]'::jsonb, 1, 'Complementary angles sum to 90° → 90 - 35 = 55', 1
from subjects s, topics t where s.slug = 'geometry' and t.title = 'Angle Relationships' and not exists (select 1 from questions where question_text like 'Two angles are complementary%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Which postulate proves congruence when three sides are equal?', '["SAS","ASA","SSS","AAS"]'::jsonb, 2, 'Side-Side-Side (SSS) proves congruence', 1
from subjects s, topics t where s.slug = 'geometry' and t.title = 'Triangle Congruence' and not exists (select 1 from questions where question_text like 'Which postulate proves congruence%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the circumference of a circle with radius 5?', '["5π","10π","25π","20π"]'::jsonb, 1, 'C = 2πr = 2π(5) = 10π', 1
from subjects s, topics t where s.slug = 'geometry' and t.title = 'Circle Theorems' and not exists (select 1 from questions where question_text like 'What is the circumference of a circle with radius 5%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the area of a trapezoid with bases 6 and 10, height 4?', '["28","32","40","20"]'::jsonb, 1, 'A = (6+10)/2 × 4 = 32', 1
from subjects s, topics t where s.slug = 'geometry' and t.title = 'Area & Perimeter' and not exists (select 1 from questions where question_text like 'What is the area of a trapezoid%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the volume of a cube with side length 4?', '["16","48","64","24"]'::jsonb, 2, 'V = s³ = 4³ = 64', 1
from subjects s, topics t where s.slug = 'geometry' and t.title = 'Volume & Surface Area' and not exists (select 1 from questions where question_text like 'What is the volume of a cube%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the distance between (0, 0) and (3, 4)?', '["3","4","5","7"]'::jsonb, 2, 'd = √(3² + 4²) = 5', 1
from subjects s, topics t where s.slug = 'geometry' and t.title = 'Coordinate Geometry' and not exists (select 1 from questions where question_text like 'What is the distance between (0, 0)%');

-- 11. Subject-level fallback questions (no topic)
insert into questions (subject_id, question_text, options, correct_index)
select id, 'Solve for x: 4x + 9 = 25', '["2","4","6","8"]'::jsonb, 1
from subjects where slug = 'algebra' and not exists (select 1 from questions where question_text like 'Solve for x: 4x + 9%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the sum of the interior angles of a pentagon?', '["360°","540°","720°","900°"]'::jsonb, 1
from subjects where slug = 'geometry' and not exists (select 1 from questions where question_text like 'What is the sum of the interior angles of a pentagon%');

-- 12. Recompute overall scores as the average of remaining subject scores
insert into user_total_scores (user_id, total_score, last_updated)
select user_id, round(avg(score))::int, now() from user_scores group by user_id
on conflict (user_id) do update set total_score = excluded.total_score, last_updated = now();

delete from user_total_scores where user_id not in (select user_id from user_scores);
