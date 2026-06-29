# Eduspark Platform

Modern Class 1-10 learning portal for students, built with a Next.js frontend and an Express backend.

Live demo: https://eduspark-plat-8cq8.vercel.app/

## Features

- Class 1-10 learning portal interface
- Student dashboard and course pages
- Exam pages and exam routing
- Google OAuth support for login
- Razorpay integration for payment flow
- JWT-based authentication with a Node.js/Express backend

## Tech Stack

- Frontend: Next.js 16, React 19, Tailwind CSS, Lucide icons
- Backend: Express, Node.js, dotenv, better-sqlite3
- Integrations: Google OAuth, Razorpay
- Deployment: Vercel

## Repository Structure

- `frontend/` - Next.js application
- `backend/` - Express API server
- `supabase_schema.sql` - Database schema reference
- `vercel.json` - Vercel deployment configuration

## Setup

### Backend

1. Open `backend/`
2. Install dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file with values required by `backend/server.js` and `backend/verify.js`.

4. Start the backend:

```bash
npm run dev
```

### Frontend

1. Open `frontend/`
2. Install dependencies:

```bash
cd frontend
npm install
```

3. Start the Next.js app:

```bash
npm run dev
```

4. Open the app in your browser at `http://localhost:3000`

## Notes

- Ensure the backend and frontend are configured with any required environment variables.
- The project uses Vercel for deployment; the current live demo is hosted at the provided URL.

## License

This repository is shared under the standard open-source terms unless otherwise specified.
