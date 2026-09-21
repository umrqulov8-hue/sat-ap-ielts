-- =====================
-- MIGRATION: ADVANCED TRACKS
-- Removes sat-math and adds advanced-math, data-analysis, problem-solving.
-- Re-runnable (all inserts guarded).
-- =====================

-- 1. Remove practice tests tied to sat-math
delete from practice_tests
where topic_id in (
  select t.id from topics t
  join modules m on m.id = t.module_id
  join subjects s on s.id = m.subject_id
  where s.slug = 'sat-math'
);
delete from practice_tests where subject = 'SAT Math';

-- 2. Remove scores for sat-math (cascade would also handle this)
delete from user_scores
where subject_id in (select id from subjects where slug = 'sat-math');

-- 3. Remove sat-math subject (cascades modules, topics, questions, progress)
delete from subjects where slug = 'sat-math';

-- 4. New subjects
insert into subjects (slug, title, description, icon, color, order_index) values
  ('advanced-math', 'Advanced Math', 'Quadratics, exponentials, logarithms, and advanced equations', '🧮', '#059669', 1),
  ('data-analysis', 'Data Analysis', 'Statistics, probability, and data interpretation', '📊', '#d97706', 4),
  ('problem-solving', 'Problem Solving', 'Ratios, word problems, estimation, and logic', '🧩', '#db2777', 5)
on conflict (slug) do nothing;

-- 5. Advanced Math modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Quadratic Functions', 'Solving quadratics and parabola graphs', 1, 6, '1.5 weeks'
from subjects where slug = 'advanced-math'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Quadratic Functions' and s.slug = 'advanced-math');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Advanced Equations', 'Rational and radical equations', 2, 6, '1.5 weeks'
from subjects where slug = 'advanced-math'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Advanced Equations' and s.slug = 'advanced-math');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Exponentials & Logarithms', 'Exponential growth and log basics', 3, 6, '1.5 weeks'
from subjects where slug = 'advanced-math'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Exponentials & Logarithms' and s.slug = 'advanced-math');

-- 6. Data Analysis modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Descriptive Statistics', 'Averages, spread, and distributions', 1, 6, '1.5 weeks'
from subjects where slug = 'data-analysis'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Descriptive Statistics' and s.slug = 'data-analysis');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Probability', 'Basic and conditional probability', 2, 6, '1.5 weeks'
from subjects where slug = 'data-analysis'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Probability' and s.slug = 'data-analysis');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Data Interpretation', 'Tables, charts, and scatterplots', 3, 6, '1.5 weeks'
from subjects where slug = 'data-analysis'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Data Interpretation' and s.slug = 'data-analysis');

-- 7. Problem Solving modules
insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Ratios & Rates', 'Unit rates and percent problems', 1, 6, '1.5 weeks'
from subjects where slug = 'problem-solving'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Ratios & Rates' and s.slug = 'problem-solving');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Word Problems', 'Age, motion, and work problems', 2, 6, '1.5 weeks'
from subjects where slug = 'problem-solving'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Word Problems' and s.slug = 'problem-solving');

insert into modules (subject_id, title, description, order_index, lesson_count, duration)
select id, 'Estimation & Logic', 'Estimation strategies and logical reasoning', 3, 6, '1.5 weeks'
from subjects where slug = 'problem-solving'
and not exists (select 1 from modules m join subjects s on s.id = m.subject_id where m.title = 'Estimation & Logic' and s.slug = 'problem-solving');

-- 8. Advanced Math topics
insert into topics (module_id, title, description, order_index)
select id, 'Solving Quadratics', 'Factoring and quadratic formula', 1 from modules where title = 'Quadratic Functions' and not exists (select 1 from topics where title = 'Solving Quadratics');
insert into topics (module_id, title, description, order_index)
select id, 'Parabolas & Vertex', 'Vertex form and graphing parabolas', 2 from modules where title = 'Quadratic Functions' and not exists (select 1 from topics where title = 'Parabolas & Vertex');
insert into topics (module_id, title, description, order_index)
select id, 'Rational Equations', 'Equations with fractions', 1 from modules where title = 'Advanced Equations' and not exists (select 1 from topics where title = 'Rational Equations');
insert into topics (module_id, title, description, order_index)
select id, 'Radical Equations', 'Square roots in equations', 2 from modules where title = 'Advanced Equations' and not exists (select 1 from topics where title = 'Radical Equations');
insert into topics (module_id, title, description, order_index)
select id, 'Exponential Growth', 'Doubling, decay, and applications', 1 from modules where title = 'Exponentials & Logarithms' and not exists (select 1 from topics where title = 'Exponential Growth');
insert into topics (module_id, title, description, order_index)
select id, 'Logarithm Basics', 'Log rules and evaluation', 2 from modules where title = 'Exponentials & Logarithms' and not exists (select 1 from topics where title = 'Logarithm Basics');

-- 9. Data Analysis topics
insert into topics (module_id, title, description, order_index)
select id, 'Mean, Median & Mode', 'Measures of center', 1 from modules where title = 'Descriptive Statistics' and not exists (select 1 from topics where title = 'Mean, Median & Mode');
insert into topics (module_id, title, description, order_index)
select id, 'Spread & Box Plots', 'Range, IQR, and box plots', 2 from modules where title = 'Descriptive Statistics' and not exists (select 1 from topics where title = 'Spread & Box Plots');
insert into topics (module_id, title, description, order_index)
select id, 'Basic Probability', 'Single-event probability', 1 from modules where title = 'Probability' and not exists (select 1 from topics where title = 'Basic Probability');
insert into topics (module_id, title, description, order_index)
select id, 'Conditional Probability', 'Probability given conditions', 2 from modules where title = 'Probability' and not exists (select 1 from topics where title = 'Conditional Probability');
insert into topics (module_id, title, description, order_index)
select id, 'Tables & Charts', 'Reading pie charts and tables', 1 from modules where title = 'Data Interpretation' and not exists (select 1 from topics where title = 'Tables & Charts');
insert into topics (module_id, title, description, order_index)
select id, 'Scatterplots & Trend', 'Correlation and trend lines', 2 from modules where title = 'Data Interpretation' and not exists (select 1 from topics where title = 'Scatterplots & Trend');

-- 10. Problem Solving topics
insert into topics (module_id, title, description, order_index)
select id, 'Unit Rates', 'Price per unit and speed', 1 from modules where title = 'Ratios & Rates' and not exists (select 1 from topics where title = 'Unit Rates');
insert into topics (module_id, title, description, order_index)
select id, 'Percent Problems', 'Discounts, tax, and percent change', 2 from modules where title = 'Ratios & Rates' and not exists (select 1 from topics where title = 'Percent Problems');
insert into topics (module_id, title, description, order_index)
select id, 'Age & Motion Problems', 'Age puzzles and distance problems', 1 from modules where title = 'Word Problems' and not exists (select 1 from topics where title = 'Age & Motion Problems');
insert into topics (module_id, title, description, order_index)
select id, 'Work Problems', 'Rates of work and combined effort', 2 from modules where title = 'Word Problems' and not exists (select 1 from topics where title = 'Work Problems');
insert into topics (module_id, title, description, order_index)
select id, 'Estimation Strategies', 'Rounding and quick estimates', 1 from modules where title = 'Estimation & Logic' and not exists (select 1 from topics where title = 'Estimation Strategies');
insert into topics (module_id, title, description, order_index)
select id, 'Logical Reasoning', 'Deduction and logical puzzles', 2 from modules where title = 'Estimation & Logic' and not exists (select 1 from topics where title = 'Logical Reasoning');

-- 11. Advanced Math questions
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Solve: x² - 9 = 0', '["3","-3","±3","9"]'::jsonb, 2, 'x² = 9 → x = ±3', 1
from subjects s, topics t where s.slug = 'advanced-math' and t.title = 'Solving Quadratics' and not exists (select 1 from questions where question_text like 'Solve: x² - 9 = 0%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the vertex of y = (x - 1)² + 2?', '["(1, 2)","(-1, 2)","(1, -2)","(0, 2)"]'::jsonb, 0, 'Vertex form y = (x - h)² + k → (1, 2)', 1
from subjects s, topics t where s.slug = 'advanced-math' and t.title = 'Parabolas & Vertex' and not exists (select 1 from questions where question_text like 'What is the vertex of y = (x - 1)%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Solve: 2/x = 4', '["2","1/2","8","4"]'::jsonb, 1, '2 = 4x → x = 1/2', 1
from subjects s, topics t where s.slug = 'advanced-math' and t.title = 'Rational Equations' and not exists (select 1 from questions where question_text like 'Solve: 2/x = 4%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Solve: √(x + 5) = 3', '["2","4","9","14"]'::jsonb, 1, 'Square both sides: x + 5 = 9 → x = 4', 1
from subjects s, topics t where s.slug = 'advanced-math' and t.title = 'Radical Equations' and not exists (select 1 from questions where question_text like 'Solve: √(x + 5) = 3%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'A population of 50 doubles every year. How many after 3 years?', '["150","200","400","800"]'::jsonb, 2, '50 × 2³ = 400', 1
from subjects s, topics t where s.slug = 'advanced-math' and t.title = 'Exponential Growth' and not exists (select 1 from questions where question_text like 'A population of 50 doubles%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is log₁₀(1000)?', '["2","3","10","100"]'::jsonb, 1, '10³ = 1000 → log = 3', 1
from subjects s, topics t where s.slug = 'advanced-math' and t.title = 'Logarithm Basics' and not exists (select 1 from questions where question_text like 'What is log₁₀(1000)%');

-- 12. Data Analysis questions
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is the mode of {2, 3, 3, 5, 7}?', '["2","3","5","7"]'::jsonb, 1, '3 appears most often', 1
from subjects s, topics t where s.slug = 'data-analysis' and t.title = 'Mean, Median & Mode' and not exists (select 1 from questions where question_text like 'What is the mode of {2, 3, 3, 5, 7}%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What does the IQR describe?', '["Average","Middle 50% spread","Maximum","Total range"]'::jsonb, 1, 'IQR = middle 50% of the data', 1
from subjects s, topics t where s.slug = 'data-analysis' and t.title = 'Spread & Box Plots' and not exists (select 1 from questions where question_text like 'What does the IQR describe%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'A bag has 3 red and 2 blue marbles. What is P(red)?', '["1/2","3/5","2/5","1/3"]'::jsonb, 1, '3 favorable out of 5 total', 1
from subjects s, topics t where s.slug = 'data-analysis' and t.title = 'Basic Probability' and not exists (select 1 from questions where question_text like 'A bag has 3 red and 2 blue marbles%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'P(A|B) means the probability of:', '["A and B","A given B","A or B","Not A"]'::jsonb, 1, 'Vertical bar reads as "given"', 1
from subjects s, topics t where s.slug = 'data-analysis' and t.title = 'Conditional Probability' and not exists (select 1 from questions where question_text like 'P(A|B) means%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'In a pie chart, what percent is one quarter?', '["20%","25%","50%","75%"]'::jsonb, 1, '100% ÷ 4 = 25%', 1
from subjects s, topics t where s.slug = 'data-analysis' and t.title = 'Tables & Charts' and not exists (select 1 from questions where question_text like 'In a pie chart, what percent is one quarter%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'A downward-trending scatterplot shows what correlation?', '["Positive","Negative","Zero","Perfect"]'::jsonb, 1, 'As x rises, y falls → negative', 1
from subjects s, topics t where s.slug = 'data-analysis' and t.title = 'Scatterplots & Trend' and not exists (select 1 from questions where question_text like 'A downward-trending scatterplot%');

-- 13. Problem Solving questions
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'If 4 apples cost $2, what is the unit price?', '["$0.25","$0.50","$2.00","$8.00"]'::jsonb, 1, '2 ÷ 4 = $0.50 per apple', 1
from subjects s, topics t where s.slug = 'problem-solving' and t.title = 'Unit Rates' and not exists (select 1 from questions where question_text like 'If 4 apples cost $2%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'What is 20% of 150?', '["20","25","30","35"]'::jsonb, 2, '0.20 × 150 = 30', 1
from subjects s, topics t where s.slug = 'problem-solving' and t.title = 'Percent Problems' and not exists (select 1 from questions where question_text like 'What is 20% of 150%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Ali is 3 times as old as Vali. Their ages sum to 24. How old is Ali?', '["6","8","12","18"]'::jsonb, 3, '3x + x = 24 → x = 6 → Ali is 18', 1
from subjects s, topics t where s.slug = 'problem-solving' and t.title = 'Age & Motion Problems' and not exists (select 1 from questions where question_text like 'Ali is 3 times as old%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'A tap fills a tank in 6 hours. What fraction is filled in 2 hours?', '["1/6","1/3","1/2","2/3"]'::jsonb, 1, 'Rate = 1/6 per hour → 2/6 = 1/3', 1
from subjects s, topics t where s.slug = 'problem-solving' and t.title = 'Work Problems' and not exists (select 1 from questions where question_text like 'A tap fills a tank in 6 hours%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'Estimate 49 × 21', '["600","800","1000","1200"]'::jsonb, 2, 'Round: 50 × 20 = 1000', 1
from subjects s, topics t where s.slug = 'problem-solving' and t.title = 'Estimation Strategies' and not exists (select 1 from questions where question_text like 'Estimate 49 × 21%');
insert into questions (subject_id, topic_id, question_text, options, correct_index, explanation, order_index)
select s.id, t.id, 'All squares are rectangles. Figure X is a square. So X is a:', '["square","rectangle","circle","triangle"]'::jsonb, 1, 'Every square belongs to the rectangle family', 1
from subjects s, topics t where s.slug = 'problem-solving' and t.title = 'Logical Reasoning' and not exists (select 1 from questions where question_text like 'All squares are rectangles%');

-- 14. Subject-level fallback questions (no topic)
insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is i²?', '["1","-1","i","0"]'::jsonb, 1
from subjects where slug = 'advanced-math' and not exists (select 1 from questions where question_text like 'What is i²%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'What is the range of {4, 9, 2, 7}?', '["5","6","7","9"]'::jsonb, 2
from subjects where slug = 'data-analysis' and not exists (select 1 from questions where question_text like 'What is the range of {4, 9, 2, 7}%');

insert into questions (subject_id, question_text, options, correct_index)
select id, 'A train travels 120 km in 2 hours. What is its speed?', '["40","50","60","80"]'::jsonb, 2
from subjects where slug = 'problem-solving' and not exists (select 1 from questions where question_text like 'A train travels 120 km%');

-- 15. Recompute overall scores as the average of remaining subject scores
insert into user_total_scores (user_id, total_score, last_updated)
select user_id, round(avg(score))::int, now() from user_scores group by user_id
on conflict (user_id) do update set total_score = excluded.total_score, last_updated = now();

delete from user_total_scores where user_id not in (select user_id from user_scores);
