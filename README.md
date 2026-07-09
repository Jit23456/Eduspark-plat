# Eduspark — Learning Platform for Classes 1–10

Full-stack education platform: **8 subjects** (Mathematics, Physics, Chemistry, Biology,
Geography, History, Computer Science, English) × **Classes 1–10**, each course with an
AI-teacher video lesson, structured curriculum, auto-graded chapter exams and live
student progress — all aligned with the [BC curriculum](https://curriculum.gov.bc.ca/).

- **Frontend:** Next.js 16 (App Router) + Tailwind CSS 4 — `frontend/`
- **Backend:** Node.js + Express — `backend/`
- **Database:** SQLite out of the box; set `SUPABASE_DB_URL` to run on Supabase Postgres
- **Auth:** Email/password + Google Sign-In (Google Identity Services)
- **Payments:** Razorpay (with a built-in demo checkout when no keys are configured)

## Features

- **Premium gating** — free accounts can browse the catalog and course outlines, but every
  lesson, AI-teacher video and exam is locked until the student buys Premium (Razorpay).
  One plan unlocks everything across all classes and subjects.
- **AI teacher video** — every course has a ~1-minute animated teacher (hand gestures,
  talking head) narrating the course intro with a humanised voice, referencing the BC
  curriculum for that grade.
- **Teacher Studio** — teachers create courses per subject + class, build the curriculum
  (lessons), author MCQ exams, and track each student's lesson progress and exam scores.
- **Student dashboard** — per-subject progress bars, lessons completed, exams taken and
  average score for the student's class.

## Quick start

```bash
# Terminal 1 — API (port 5000). First run creates + seeds the database automatically.
cd backend
npm install
npm run dev

# Terminal 2 — web app (port 3000)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Demo accounts

| Role            | Email                 | Password    |
| --------------- | --------------------- | ----------- |
| Student (free)  | student@eduspark.com  | Student123! |
| Student (premium) | premium@eduspark.com | Premium123! |
| Teacher         | teacher@eduspark.com  | Teacher123! |
| Admin           | admin@eduspark.com    | Admin123!   |

## Configuration (`backend/.env`, see `.env.example`)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Sign-In (same value goes in `frontend/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Real Razorpay checkout; leave empty for the demo checkout |
| `SUPABASE_DB_URL` | Supabase Postgres connection string; leave empty for local SQLite. Schema also in `backend/supabase-schema.sql` |
| `JWT_SECRET` | Token signing secret |

## API overview

- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/google` · `GET /api/auth/me` · `PATCH /api/auth/profile`
- `GET /api/catalog/subjects` · `GET /api/catalog/courses?subject=&class_level=`
- `GET /api/courses/:id` (outline) · `GET /api/courses/:id/lessons/:lid` (premium) · `POST …/complete`
- `GET /api/courses/exams/:eid/take` · `POST /api/courses/exams/:eid/submit` (premium, server-graded)
- `GET /api/progress/me`
- `POST /api/payments/create-order` · `POST /api/payments/verify` · `GET /api/payments/plans`
- `GET /api/teacher/overview` + full CRUD for courses/lessons/exams/questions · `GET /api/teacher/courses/:id/students`
