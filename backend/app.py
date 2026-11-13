"""Flask API for browsing events and managing event registrations."""

import os
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv()

app = Flask(__name__)


@app.after_request
def add_frontend_cors(response):
    """Allow the local CampusPulse dev server to call this API from a browser."""
    allowed_origins = {
        origin.strip()
        for origin in os.environ.get(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    }
    origin = request.headers.get("Origin")
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    return response

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set")

supabase: Client = create_client(supabase_url, supabase_key)


def api_error(message, status):
    return jsonify({"error": message}), status


@app.get("/")
def index():
    return jsonify({"message": "Events API is running"})


@app.get("/api/events")
def list_events():
    try:
        events = supabase.table("events").select("*").execute().data
        registrations = supabase.table("registrations").select("event_id").execute().data
        counts = {}
        for registration in registrations:
            event_key = str(registration.get("event_id"))
            counts[event_key] = counts.get(event_key, 0) + 1
        for event in events:
            capacity = event.get("capacity")
            count = counts.get(str(event.get("id")), 0)
            event["registered_count"] = count
            event["remaining_capacity"] = max(int(capacity) - count, 0) if capacity is not None else None
        return jsonify(events), 200
    except APIError as error:
        app.logger.exception("Could not list events")
        return api_error("Could not load events.", 500)


@app.get("/api/events/<event_id>")
def get_event(event_id):
    try:
        response = (supabase.table("events").select("*")
                    .eq("id", event_id).limit(1).execute())
        if not response.data:
            return api_error("Event not found.", 404)
        return jsonify(response.data[0]), 200
    except APIError:
        app.logger.exception("Could not load event %s", event_id)
        return api_error("Could not load event.", 500)


@app.post("/api/registrations")
def create_registration():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return api_error("Request body must be a JSON object.", 400)
    event_id = body.get("event_id")
    uid = body.get("user_id")
    if event_id is None or not str(event_id).strip():
        return api_error("event_id is required.", 400)
    if uid is None or not str(uid).strip():
        return api_error("user_id is required. Enter your database user ID in the frontend when prompted.", 400)

    try:
        event_response = (supabase.table("events").select("id,capacity")
                          .eq("id", event_id).limit(1).execute())
        if not event_response.data:
            return api_error("Event not found.", 404)
        event = event_response.data[0]

        existing = (supabase.table("registrations").select("id")
                    .eq("event_id", event_id).eq("user_id", uid)
                    .limit(1).execute())
        if existing.data:
            return api_error("You are already registered for this event.", 409)

        registration_count = (supabase.table("registrations").select("id", count="exact")
                              .eq("event_id", event_id).execute()).count or 0
        capacity = event.get("capacity")
        if capacity is not None and registration_count >= int(capacity):
            return api_error("This event is full.", 409)

        result = (supabase.table("registrations")
                  .insert({"event_id": event_id, "user_id": uid}).execute())
        new_count = registration_count + 1
        registration = result.data[0] if result.data else {
            "event_id": event_id, "user_id": uid
        }
        registration["registered_count"] = new_count
        registration["remaining_capacity"] = max(int(capacity) - new_count, 0) if capacity is not None else None
        return jsonify(registration), 201
    except APIError as error:
        # A unique constraint on (event_id, user_id) closes the concurrent
        # duplicate-registration race; report that conflict as HTTP 409.
        code = getattr(error, "code", None)
        if code == "23505":
            return api_error("You are already registered for this event.", 409)
        app.logger.exception("Could not create registration")
        return api_error(
            "The database rejected this registration. Check that the user ID is valid and that registrations allow inserts.",
            400,
        )


@app.get("/api/me/registrations")
def my_registrations():
    uid = request.args.get("user_id", "").strip()
    if not uid:
        return api_error("user_id query parameter is required.", 400)
    try:
        response = (supabase.table("registrations").select("*")
                    .eq("user_id", uid).execute())
        return jsonify(response.data), 200
    except APIError:
        app.logger.exception("Could not load user registrations")
        return api_error("Could not load registrations.", 500)


@app.get("/api/events/<event_id>/registrations")
def event_registrations(event_id):
    try:
        event_response = (supabase.table("events").select("*")
                          .eq("id", event_id).limit(1).execute())
        if not event_response.data:
            return api_error("Event not found.", 404)
        response = (supabase.table("registrations").select("*")
                    .eq("event_id", event_id).execute())
        return jsonify(response.data), 200
    except APIError:
        app.logger.exception("Could not load attendees for event %s", event_id)
        return api_error("Could not load event registrations.", 500)


if __name__ == "__main__":
    app.run(debug=True)

