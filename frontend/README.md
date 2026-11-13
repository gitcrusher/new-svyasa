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

The backend's Bearer-token checks were removed for this requested no-login setup. The frontend asks once for a database user UUID when you register or open My registrations, then keeps it in local browser storage. This is an identifier, not a password or token. Organizer attendee rows are now public to anyone who can reach this API, and the role dropdown only controls the frontend view; the backend cannot securely verify roles without authentication.

The provided backend contains no database role endpoint or schema. The dropdown uses `Attendee` and `Organizer`, the only role names in the supplied frontend draft. The backend has no event create/edit routes, so those actions are not included.
