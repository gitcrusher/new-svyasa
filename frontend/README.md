# CampusPulse React frontend

React + Vite frontend based on the supplied CampusPulse design, connected to the Flask API in `backend/app.py`.

## Run in two terminals

1. Terminal 1: `cd "C:\Users\aayus\Downloads\new svyasa\backend"` then run `python app.py`.
2. Terminal 2: `cd "C:\Users\aayus\Downloads\new svyasa\frontend"` then run `npm install` once and `npm run dev`.
3. Open the Vite URL shown in the frontend terminal, usually `http://localhost:5173`.

If the API uses a different URL, create `.env.local` here with `VITE_API_BASE_URL=http://127.0.0.1:5000`, then restart Vite.

## API behavior

- `GET /api/events` and `GET /api/events/<id>` load events without a token.
- `POST /api/registrations` accepts `event_id` and `user_id`.
- `GET /api/me/registrations?user_id=<id>` loads that user's registrations.
- `GET /api/events/<id>/registrations` returns an event's attendee rows.

The backend's Bearer-token checks were removed for this requested no-login setup. The Student and Organizer dropdowns load users from `GET /api/users?role=student|organizer`, including their email and database ID. Admin is excluded from these identity selectors. Selected IDs stay in local browser storage. These IDs are identifiers, not passwords or tokens. Organizer attendee rows are now public to anyone who can reach this API, and the role dropdown only controls the frontend view; the backend cannot securely verify roles without authentication.

The backend now provides `GET /api/users?role=student|organizer` and `POST /api/events` (title, capacity, organizer_id; status defaults to `upcoming`). Event creation writes to the existing `events` table. If Supabase row-level security blocks inserts, set `SUPABASE_SERVICE_ROLE_KEY` as a backend-only Render environment variable; never put this key in the frontend. The Organizer page shows event and registration status and attendee lists. The Admin dashboard remains read-only. Role switching is not authentication or secure authorization in this no-login setup.
