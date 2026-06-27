-- ========================================================
-- EDUSPARK PLATFORM - SUPABASE POSTGRESQL SCHEMA & SEED
-- Project Ref: mezznnglfgygkecfyacd
-- Copy and paste this entire script into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mezznnglfgygkecfyacd/sql/new
-- ========================================================

-- 1. DROP EXISTING TABLES (IF ANY)
DROP TABLE IF EXISTS progress CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. CREATE TABLES
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone_number TEXT,
    name TEXT NOT NULL,
    picture TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'student', -- 'student' or 'teacher'
    has_paid INTEGER NOT NULL DEFAULT 0, -- 0 for unpaid, 1 for paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    subject TEXT NOT NULL, -- geography, history, math, physics, chemistry, biology, computer_science, english
    class_number INTEGER NOT NULL, -- 1 to 10
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    video_url TEXT,
    pdf_url TEXT,
    day_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON string array
    correct_option INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    answers TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, lesson_id)
);

-- 3. INSERT DEMO USER ACCOUNTS
INSERT INTO users (id, email, name, picture, role, has_paid) VALUES
('mock_teacher_id', 'teacher@eduspark.com', 'Professor Sarah Smith', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'teacher', 1),
('mock_paid_student_id', 'student.paid@eduspark.com', 'Alex Miller (Paid Student)', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', 'student', 1),
('mock_unpaid_student_id', 'student.unpaid@eduspark.com', 'Jordan Vance (Unpaid Student)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'student', 0);

-- 4. SEED 70 COURSES AND 490 LESSONS VIA PL/PGSQL BLOCK
DO $$
DECLARE
    class_num INT;
    sub RECORD;
    c_id INT;
    e_id INT;
    day_idx INT;
    v_url TEXT;
    sub_list CURSOR FOR 
        SELECT * FROM (VALUES 
            ('geography', 'Geography', 'Explore physical geography, climate systems, mapping, and human demographics.', 'https://www.youtube.com/embed/jNQXAC9IVRw'),
            ('history', 'History', 'Journey through ancient empires, historical milestones, global revolutions, and world heritage.', 'https://www.youtube.com/embed/Yocja_N5s1I'),
            ('math', 'Math', 'Foundations of numbers, geometric proofs, algebraic equations, and analytical logic.', 'https://www.youtube.com/embed/dpUbg244xXk'),
            ('physics', 'Physics', 'Study of forces, mechanics, light optics, thermodynamics, and energy.', 'https://www.youtube.com/embed/kKKM8Y-u7ds'),
            ('chemistry', 'Chemistry', 'Discover chemical reactions, atomic orbital models, covalent bonds, acids, and bases.', 'https://www.youtube.com/embed/rd0fW3wTstU'),
            ('biology', 'Biology', 'Study cell biology, ecosystems, human anatomy, genetics, and environmental biology.', 'https://www.youtube.com/embed/8IlzK7Z5cGg'),
            ('computer_science', 'Computer Science', 'Introduction to computational logic, algorithms, digital literacy, and modern software.', 'https://www.youtube.com/embed/zOjov-2OZ0E'),
            ('english', 'English', 'Grammar mastery, literature analysis, essay composition, and vocabulary development.', 'https://www.youtube.com/embed/14-bE-pE3iQ')
        ) AS t(id, name, descr, video);
BEGIN
    FOR class_num IN 1..10 LOOP
        FOR sub IN SELECT * FROM (VALUES 
            ('geography', 'Geography', 'Explore physical geography, climate systems, mapping, and human demographics.', 'https://www.youtube.com/embed/jNQXAC9IVRw'),
            ('history', 'History', 'Journey through ancient empires, historical milestones, global revolutions, and world heritage.', 'https://www.youtube.com/embed/Yocja_N5s1I'),
            ('math', 'Math', 'Foundations of numbers, geometric proofs, algebraic equations, and analytical logic.', 'https://www.youtube.com/embed/dpUbg244xXk'),
            ('physics', 'Physics', 'Study of forces, mechanics, light optics, thermodynamics, and energy.', 'https://www.youtube.com/embed/kKKM8Y-u7ds'),
            ('chemistry', 'Chemistry', 'Discover chemical reactions, atomic orbital models, covalent bonds, acids, and bases.', 'https://www.youtube.com/embed/rd0fW3wTstU'),
            ('biology', 'Biology', 'Study cell biology, ecosystems, human anatomy, genetics, and environmental biology.', 'https://www.youtube.com/embed/8IlzK7Z5cGg'),
            ('computer_science', 'Computer Science', 'Introduction to computational logic, algorithms, digital literacy, and modern software.', 'https://www.youtube.com/embed/zOjov-2OZ0E'),
            ('english', 'English', 'Grammar mastery, literature analysis, essay composition, and vocabulary development.', 'https://www.youtube.com/embed/14-bE-pE3iQ')
        ) AS t(id, name, descr, video) LOOP
            
            -- Insert Course
            INSERT INTO courses (subject, class_number, title, description)
            VALUES (sub.id, class_num, sub.name || ' for Class ' || class_num, 'Standard curriculum for Class ' || class_num || ' ' || sub.name || '. ' || sub.descr)
            RETURNING id INTO c_id;

            -- Insert 7 Day Lessons
            FOR day_idx IN 1..7 LOOP
                INSERT INTO lessons (course_id, title, content, order_index, video_url, pdf_url, day_number)
                VALUES (
                    c_id, 
                    'Day ' || day_idx || ': Core Learning Module of ' || sub.name, 
                    '<h2>Welcome to Class ' || class_num || ' ' || sub.name || ' &bull; Day ' || day_idx || '</h2><p>Today we explore foundational principles of ' || sub.name || '. Focus on video lecture notes and practice worksheets.</p><ul><li>Watch the accompanying HD video lecture in full.</li><li>Download the PDF worksheet and complete all exercises.</li><li>Take detailed notes for the upcoming chapter exam.</li></ul>', 
                    day_idx, 
                    sub.video, 
                    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 
                    day_idx
                );
            END LOOP;

            -- Insert Exam
            INSERT INTO exams (course_id, title, description)
            VALUES (c_id, sub.name || ' Chapter 1 Exam', 'Test your understanding of the introductory lessons in ' || sub.name || '.')
            RETURNING id INTO e_id;

            -- Insert Questions based on Subject
            IF sub.id = 'chemistry' THEN
                INSERT INTO questions (exam_id, question_text, options, correct_option) VALUES
                (e_id, 'What is the chemical symbol for water?', '["CO2", "H2O", "NaCl", "O2"]', 1),
                (e_id, 'Which subatomic particle has a negative charge?', '["Proton", "Neutron", "Electron", "Positron"]', 2),
                (e_id, 'What is the pH level of pure water?', '["5", "7", "9", "14"]', 1);
            ELSIF sub.id = 'math' THEN
                INSERT INTO questions (exam_id, question_text, options, correct_option) VALUES
                (e_id, 'What is the value of 5 + (3 * 2)?', '["11", "16", "13", "10"]', 0),
                (e_id, 'Which property states that a + b = b + a?', '["Distributive", "Associative", "Commutative", "Identity"]', 2),
                (e_id, 'If x + 5 = 15, what is the value of x?', '["20", "10", "75", "3"]', 1);
            ELSE
                INSERT INTO questions (exam_id, question_text, options, correct_option) VALUES
                (e_id, 'Which of the following is core to this module?', '["Study of structures", "Random guessing", "Complex mental math", "None"]', 0),
                (e_id, 'True or False: Scientific principles apply globally.', '["True", "False"]', 0),
                (e_id, 'What is the primary method of evaluation?', '["Essay", "Multiple choice quiz", "Oral recitation", "Lab report"]', 1);
            END IF;

        END LOOP;
    END LOOP;
END $$;

-- 5. VERIFY SEEDED DATA
SELECT 'Users Created' AS status, COUNT(*) AS count FROM users
UNION ALL
SELECT 'Courses Created', COUNT(*) FROM courses
UNION ALL
SELECT 'Lessons Created', COUNT(*) FROM lessons
UNION ALL
SELECT 'Exams Created', COUNT(*) FROM exams;
