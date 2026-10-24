import hmac
import os
import re

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()
from db import execute, query  # noqa: E402  (after load_dotenv)

app = Flask(__name__, static_folder="static")
app.config.update(
    SECRET_KEY=os.environ["SECRET_KEY"],
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=5 * 1024 * 1024,
)
limiter = Limiter(get_remote_address, app=app)

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,29}$")
USER_RE = re.compile(r"^[a-z0-9_]{3,20}$")
DUMMY_HASH = generate_password_hash("dummy-password")  # keeps login timing similar for unknown users


def body():
    return request.get_json(silent=True) or {}


def err(msg, code=400):
    return jsonify(error=msg), code


def code_ok(role, code):
    expected = os.environ.get("ADMIN_CODE" if role == "admin" else "VET_CODE", "")
    return bool(expected) and hmac.compare_digest(str(code or "").encode(), expected.encode())


def admin_code_ok(code):
    # The code lives in .env on the server, never in the browser.
    return hmac.compare_digest(str(code or "").encode(), os.environ["ADMIN_CODE"].encode())


def public_user(row):
    return {"name": row["full_name"], "role": row["role"]}


@app.before_request
def json_only():
    # Browsers cannot send cross-site JSON without CORS permission, which blocks CSRF.
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not request.is_json and request.endpoint != "core.upload_photo":
        return err("JSON requests only.", 415)


@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "same-origin"
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.post("/api/admin-code")
@limiter.limit("10/minute")
def check_code():
    if code_ok(body().get("role", "admin"), body().get("code")):
        return jsonify(ok=True)
    return err("That code is not valid.", 403)


@app.post("/api/register")
@limiter.limit("10/minute")
def register():
    b = body()
    name = str(b.get("name", "")).strip()
    user = str(b.get("username", "")).strip().lower()
    pw = str(b.get("password", ""))
    role = b.get("role")
    if not NAME_RE.match(name):
        return err("Name should use letters only.")
    if not USER_RE.match(user):
        return err("Username: 3 to 20 letters, numbers or underscores.")
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        return err("Password needs 8+ characters with a letter and a number.")
    if role not in ("admin", "adopter", "vet"):
        return err("Choose a role.")
    if role in ("admin", "vet") and not code_ok(role, b.get("admin_code")):
        return err("Admin code is not valid.", 403)
    email, phone = str(b.get("email", "")).strip().lower(), str(b.get("phone", "")).strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 80:
        return err("Enter a valid email address.")
    if phone and not re.fullmatch(r"\d{10}", phone):
        return err("Phone should be 10 digits.")
    try:
        execute("INSERT INTO users (full_name, username, password_hash, role, email, phone) VALUES (%s, %s, %s, %s, %s, %s)",
                (name, user, generate_password_hash(pw), role, email, phone or None))
    except mysql.connector.IntegrityError:
        return err("That username is taken.", 409)
    execute("INSERT INTO audit_log (action) VALUES (%s)", (f"New {role} account registered: {user}",))
    return jsonify(ok=True), 201


@app.post("/api/login")
@limiter.limit("10/minute")
def login():
    b = body()
    user = str(b.get("username", "")).strip().lower()
    pw = str(b.get("password", ""))
    row = query("SELECT user_id, full_name, role, password_hash FROM users WHERE username = %s", (user,), one=True)
    ok = check_password_hash(row["password_hash"] if row else DUMMY_HASH, pw)
    if not (row and ok and row["role"] == b.get("role")):
        return err("Those details do not match this role.", 401)
    session.clear()
    session["uid"] = row["user_id"]
    session["role"] = row["role"]
    return jsonify(user=public_user(row))


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    uid = session.get("uid")
    row = query("SELECT full_name, role FROM users WHERE user_id = %s", (uid,), one=True) if uid else None
    return jsonify(user=public_user(row) if row else None)


@app.get("/api/pets")
def pets():
    rows = query("""SELECT p.pet_id AS id, p.name, p.species, p.breed, p.size, p.energy,
                           p.shelter_id, p.featured, p.fee_discount, p.good_with_kids, p.good_with_pets, p.status, p.vaccinated,
                           p.behavior_checked, p.under_treatment, p.photo_url,
                           s.name AS shelter, DATEDIFF(CURDATE(), p.intake_date) AS days
                    FROM pets p JOIN shelters s ON s.shelter_id = p.shelter_id
                    ORDER BY p.pet_id""")
    return jsonify(pets=rows)


from api_core import bp, log, notify  # noqa: E402

app.register_blueprint(bp)
from api_extras import bp5  # noqa: E402

app.register_blueprint(bp5)
from api_vet import bp6  # noqa: E402

app.register_blueprint(bp6)


@app.post("/api/stray")
@limiter.limit("5/hour")
def stray():
    b = body()
    loc, note = str(b.get("location", "")).strip()[:80], str(b.get("note", "")).strip()[:100]
    if len(loc) < 3:
        return err("Please add a location.")
    log(None, f"Stray report: {loc} ({note})" if note else f"Stray report: {loc}")
    notify(f"Stray report at {loc}", admin=True)
    return jsonify(ok=True), 201


@app.post("/api/donations")
@limiter.limit("20/hour")
def donate():
    amount = body().get("amount")
    if amount not in (500, 1000, 2500):  # preset amounts only; this is a demo checkout, no payment is taken
        return err("Please pick one of the amounts.")
    execute("INSERT INTO donations (amount, note) VALUES (%s, 'demo')", (amount,))
    log(None, f"Demo donation of Rs {amount}")
    return jsonify(total=int(query("SELECT COALESCE(SUM(amount), 0) AS t FROM donations", one=True)["t"])), 201


if __name__ == "__main__":
    app.run()
