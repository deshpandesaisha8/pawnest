import json
import os
import re
import uuid
from datetime import date, timedelta

import mysql.connector
from flask import Blueprint, current_app, jsonify, request, session
from PIL import Image

from db import execute, pool, query
from mailer import alert

Image.MAX_IMAGE_PIXELS = 25_000_000
bp = Blueprint("core", __name__)
SLOTS = ["10:00", "11:30", "14:00", "15:30", "17:00"]
SPECIES = ("Dog", "Cat", "Rabbit", "Bird", "Guinea Pig", "Hamster", "Turtle")
READY = "status='Available' AND vaccinated=1 AND behavior_checked=1 AND under_treatment=0"
NAME = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,29}$")


def err(msg, code=400):
    return jsonify(error=msg), code


def body():
    return request.get_json(silent=True) or {}


def need(role=None):
    """Returns (user, None) or (None, error_response). Every protected route starts with this."""
    uid = session.get("uid")
    u = query("SELECT user_id, full_name, role FROM users WHERE user_id=%s", (uid,), one=True) if uid else None
    if not u:
        return None, err("Please sign in.", 401)
    if role and u["role"] not in ((role,) if isinstance(role, str) else role):
        return None, err("You do not have permission for that.", 403)
    return u, None


def log(uid, text):
    execute("INSERT INTO audit_log (user_id, action) VALUES (%s, %s)", (uid, text[:200]))


def notify(text, uid=None, admin=False):
    execute("INSERT INTO notifications (user_id, for_admin, message) VALUES (%s, %s, %s)", (uid, admin, text[:200]))
    alert(text, uid, admin)  # email / WhatsApp, only if configured in .env


# ---------- pets ----------
@bp.post("/api/pets")
def add_pet():
    u, e = need("admin")
    if e:
        return e
    b = body()
    name, breed = str(b.get("name", "")).strip(), str(b.get("breed", "")).strip()
    sp, sz, en, sh = b.get("species"), b.get("size"), b.get("energy"), b.get("shelter_id")
    if not NAME.match(name) or not NAME.match(breed):
        return err("Name and breed should use letters only.")
    if sp not in SPECIES or sz not in ("Small", "Medium", "Large") or en not in ("Low", "Medium", "High"):
        return err("Please pick valid options.")
    if not isinstance(sh, int) or not query("SELECT 1 FROM shelters WHERE shelter_id=%s", (sh,), one=True):
        return err("Please pick a shelter.")
    try:
        execute("INSERT INTO pets (name, species, breed, size, energy, shelter_id, intake_date) VALUES (%s,%s,%s,%s,%s,%s,CURDATE())",
                (name, sp, breed, sz, en, sh))
    except mysql.connector.Error as ex:
        if ex.errno == 1644:  # raised by the capacity trigger
            return err("That shelter cannot take another animal of this kind.", 409)
        raise
    log(u["user_id"], f"Added animal {name}")
    return jsonify(ok=True), 201


HEALTH = {"vac": ("vaccinated", 1), "beh": ("behavior_checked", 1), "tr": ("under_treatment", 0)}


@bp.post("/api/pets/<int:pid>/health")
def health(pid):
    u, e = need(("admin", "vet"))
    if e:
        return e
    f = HEALTH.get(body().get("field"))
    pet = query("SELECT name FROM pets WHERE pet_id=%s", (pid,), one=True)
    if not f or not pet:
        return err("Not found.", 404)
    execute(f"UPDATE pets SET {f[0]}=%s WHERE pet_id=%s", (f[1], pid))  # column comes from the fixed dict above
    log(u["user_id"], f"Updated health record for {pet['name']} ({f[0]})")
    return jsonify(ok=True)


@bp.post("/api/pets/<int:pid>/<what>")
def toggle(pid, what):
    u, e = need("admin")
    if e:
        return e
    col = {"feature": "featured", "discount": "fee_discount"}.get(what)
    pet = query("SELECT name FROM pets WHERE pet_id=%s", (pid,), one=True)
    if not col or not pet:
        return err("Not found.", 404)
    execute(f"UPDATE pets SET {col} = NOT {col} WHERE pet_id=%s", (pid,))
    log(u["user_id"], f"Toggled {col.replace('_', ' ')} for {pet['name']}")
    return jsonify(ok=True)


@bp.post("/api/pets/<int:pid>/photo")
def upload_photo(pid):
    u, e = need("admin")
    if e:
        return e
    if request.headers.get("X-Requested-With") != "pawnest":
        return err("Bad request.")
    f = request.files.get("photo")
    pet = query("SELECT name FROM pets WHERE pet_id=%s", (pid,), one=True)
    if not f or not pet:
        return err("Choose a photo first.")
    try:
        img = Image.open(f.stream)
        img.verify()
        f.stream.seek(0)
        img = Image.open(f.stream)
        fmt = img.format
        img = img.convert("RGB")
    except Exception:
        return err("That file is not a valid image.")
    if fmt not in ("JPEG", "PNG", "WEBP"):
        return err("Use a JPG, PNG or WebP image.")
    img.thumbnail((900, 900))
    folder = os.path.join(current_app.static_folder, "uploads", "pets")
    os.makedirs(folder, exist_ok=True)
    name = uuid.uuid4().hex + ".webp"  # never reuse the user's filename
    img.save(os.path.join(folder, name), "WEBP", quality=82)
    execute("UPDATE pets SET photo_url=%s WHERE pet_id=%s", ("/static/uploads/pets/" + name, pid))
    log(u["user_id"], f"Uploaded a photo for {pet['name']}")
    return jsonify(ok=True)


# ---------- applications ----------
@bp.get("/api/applications")
def apps():
    u, e = need()
    if e:
        return e
    sql = ("SELECT a.application_id AS id, a.pet_id, u.full_name AS who, a.status, a.stage, a.match_score, a.details "
           "FROM applications a JOIN users u ON u.user_id = a.user_id")
    if u["role"] == "admin":
        rows = query(sql + " ORDER BY a.application_id")
    else:
        rows = query(sql + " WHERE a.user_id=%s ORDER BY a.application_id", (u["user_id"],))
    for r in rows:
        r["details"] = json.loads(r["details"]) if r["details"] else None
    return jsonify(applications=rows)


@bp.post("/api/applications")
def apply():
    u, e = need("adopter")
    if e:
        return e
    b = body()
    pid, d = b.get("pet_id"), b.get("details") or {}
    pet = query(f"SELECT name FROM pets WHERE pet_id=%s AND {READY}", (pid,), one=True) if isinstance(pid, int) else None
    if not pet:
        return err("That animal is not ready for adoption yet.", 409)
    if query("SELECT 1 FROM applications WHERE pet_id=%s AND user_id=%s AND status='Submitted'", (pid, u["user_id"]), one=True):
        return err("You already applied for this animal.", 409)
    choices = {"ht": ("House", "Apartment"), "ow": ("Own", "Rent"), "yd": ("Yes", "No"),
               "pp": ("None", "Some", "Many"), "hr": ("Under 4", "4 to 8", "Over 8")}
    if not re.fullmatch(r"\d{10}", str(d.get("ph", ""))) or not NAME.match(str(d.get("ct", ""))) or not NAME.match(str(d.get("rf", ""))):
        return err("Please check your phone, city and reference name.")
    if any(d.get(k) not in v for k, v in choices.items()):
        return err("Please complete every answer.")
    clean = {k: d[k] for k in ("ph", "ct", "rf", *choices)}
    try:
        score = max(0, min(100, int(b.get("score", 60))))
    except (TypeError, ValueError):
        score = 60
    execute("INSERT INTO applications (pet_id, user_id, match_score, details) VALUES (%s,%s,%s,%s)",
            (pid, u["user_id"], score, json.dumps(clean)))
    log(u["user_id"], f"Submitted application for {pet['name']}")
    notify(f"New application for {pet['name']} from {u['full_name']}", admin=True)
    return jsonify(ok=True), 201


def app_row(aid):
    return query("SELECT a.application_id, a.status, a.stage, a.user_id, p.name AS pet FROM applications a "
                 "JOIN pets p ON p.pet_id = a.pet_id WHERE a.application_id=%s", (aid,), one=True)


@bp.post("/api/applications/<int:aid>/<action>")
def app_action(aid, action):
    u, e = need("admin")
    if e:
        return e
    a = app_row(aid)
    if not a or action not in ("advance", "approve", "decline"):
        return err("Not found.", 404)
    if a["status"] != "Submitted":
        return err("That application is already closed.", 409)
    stages = ["Submitted", "Under review", "Home check", "Meet and greet", "Approved"]
    if action == "advance":
        if a["stage"] >= 3:
            return err("Use Approve to finish this application.", 409)
        execute("UPDATE applications SET stage = stage + 1 WHERE application_id=%s", (aid,))
        log(u["user_id"], f"Moved application #{aid} ({a['pet']}) to {stages[a['stage'] + 1]}")
        notify(f"Your application for {a['pet']} is now: {stages[a['stage'] + 1]}", uid=a["user_id"])
    elif action == "approve":
        con = pool().get_connection()
        cur = con.cursor()
        try:
            cur.callproc("sp_approve_application", (aid,))  # one transaction: approve, reject others, mark adopted
            con.commit()
        except mysql.connector.Error as ex:
            if ex.errno == 1644:  # raised by the procedure when the application is no longer open
                return err("That application is already closed.", 409)
            raise
        finally:
            cur.close()
            con.close()
        log(u["user_id"], f"Approved application #{aid} for {a['pet']}")
        notify(f"Congratulations! Your application for {a['pet']} was approved.", uid=a["user_id"])
    else:
        execute("UPDATE applications SET status='Rejected' WHERE application_id=%s", (aid,))
        log(u["user_id"], f"Declined application #{aid} for {a['pet']}")
        notify(f"Your application for {a['pet']} was declined.", uid=a["user_id"])
    return jsonify(ok=True)


# ---------- visits ----------
@bp.get("/api/visits")
def visits():
    u, e = need()
    if e:
        return e
    sql = ("SELECT v.visit_id AS id, v.pet_id, u.full_name AS who, v.visit_date, v.slot "
           "FROM visits v JOIN users u ON u.user_id = v.user_id")
    if u["role"] == "admin":
        rows = query(sql + " ORDER BY v.visit_date, v.slot")
    else:
        rows = query(sql + " WHERE v.user_id=%s ORDER BY v.visit_date, v.slot", (u["user_id"],))
    for r in rows:
        r["date"] = r.pop("visit_date").isoformat()
    return jsonify(visits=rows)


@bp.post("/api/visits")
def book_visit():
    u, e = need("adopter")
    if e:
        return e
    b = body()
    pid, day, slot = b.get("pet_id"), str(b.get("date", "")), b.get("slot")
    pet = query("SELECT name FROM pets WHERE pet_id=%s AND status='Available'", (pid,), one=True) if isinstance(pid, int) else None
    try:
        d = date.fromisoformat(day)
    except ValueError:
        return err("Pick a valid date.")
    if not pet or slot not in SLOTS:
        return err("Please pick an animal and a time.")
    if not (date.today() + timedelta(days=1) <= d <= date.today() + timedelta(days=30)):
        return err("Pick a date within the next 30 days.")
    try:
        execute("INSERT INTO visits (pet_id, user_id, visit_date, slot) VALUES (%s,%s,%s,%s)", (pid, u["user_id"], day, slot))
    except mysql.connector.IntegrityError:
        return err("That slot is taken. Pick another time.", 409)
    log(u["user_id"], f"Booked visit with {pet['name']} on {day} {slot}")
    notify(f"{u['full_name']} booked a visit with {pet['name']} on {day} at {slot}", admin=True)
    notify(f"Visit confirmed: {pet['name']}, {day} at {slot}", uid=u["user_id"])
    return jsonify(ok=True), 201


@bp.delete("/api/visits/<int:vid>")
def cancel_visit(vid):
    u, e = need()
    if e:
        return e
    v = query("SELECT user_id FROM visits WHERE visit_id=%s", (vid,), one=True)
    if not v or (u["role"] != "admin" and v["user_id"] != u["user_id"]):
        return err("Not found.", 404)
    execute("DELETE FROM visits WHERE visit_id=%s", (vid,))
    log(u["user_id"], f"Cancelled visit #{vid}")
    return jsonify(ok=True)


# ---------- notifications and activity log ----------
@bp.get("/api/notifications")
def notes():
    u, e = need()
    if e:
        return e
    rows = query("SELECT note_id AS id, message, is_read FROM notifications WHERE user_id=%s OR (for_admin=1 AND %s) "
                 "ORDER BY note_id DESC LIMIT 30", (u["user_id"], u["role"] == "admin"))
    return jsonify(notes=rows)


@bp.post("/api/notifications/read")
def read_notes():
    u, e = need()
    if e:
        return e
    execute("UPDATE notifications SET is_read=1 WHERE user_id=%s OR (for_admin=1 AND %s)", (u["user_id"], u["role"] == "admin"))
    return jsonify(ok=True)


@bp.get("/api/log")
def activity():
    u, e = need("admin")
    if e:
        return e
    rows = query("SELECT l.created_at, COALESCE(u.full_name, 'System') AS w, l.action AS a FROM audit_log l "
                 "LEFT JOIN users u ON u.user_id = l.user_id ORDER BY l.log_id DESC LIMIT 60")
    for r in rows:
        r["t"] = r.pop("created_at").strftime("%d %b %Y, %H:%M")
    return jsonify(log=rows)


# ---------- preferences, favorites, donations ----------
ENUMS = {"sp": ("species", ("Any", *SPECIES)), "sz": ("size", ("Any", "Small", "Medium", "Large")),
         "en": ("energy", ("Any", "Low", "Medium", "High")), "home": ("home_type", ("House", "Apartment")),
         "exp": ("experience", ("First-time", "Some", "Experienced"))}
FLAGS = {"yard": "has_yard", "kids": "has_kids", "op": "open_to_special"}


def pref_json(r):
    out = {k: r[col] for k, (col, _) in ENUMS.items()}
    out.update({k: int(r[col]) for k, col in FLAGS.items()})
    return out


@bp.get("/api/preferences")
def get_pref():
    u, e = need("adopter")
    if e:
        return e
    r = query("SELECT * FROM adopter_preferences WHERE user_id=%s", (u["user_id"],), one=True)
    return jsonify(pref=pref_json(r) if r else None)


@bp.post("/api/preferences")
def save_pref():
    u, e = need("adopter")
    if e:
        return e
    b = body()
    if any(b.get(k) not in vals for k, (_, vals) in ENUMS.items()):
        return err("Please pick from the lists.")
    flags = {k: 1 if b.get(k) in (1, True) else 0 for k in FLAGS}
    cols = [c for c, _ in ENUMS.values()] + list(FLAGS.values())
    vals = [b[k] for k in ENUMS] + [flags[k] for k in FLAGS]
    execute(f"INSERT INTO adopter_preferences (user_id, {', '.join(cols)}) VALUES (%s, {', '.join(['%s'] * len(cols))}) "
            f"ON DUPLICATE KEY UPDATE {', '.join(c + '=VALUES(' + c + ')' for c in cols)}", [u["user_id"], *vals])
    r = query("SELECT * FROM adopter_preferences WHERE user_id=%s", (u["user_id"],), one=True)
    return jsonify(pref=pref_json(r))


@bp.get("/api/favorites")
def get_favs():
    u, e = need("adopter")
    if e:
        return e
    return jsonify(ids=[r["pet_id"] for r in query("SELECT pet_id FROM favorites WHERE user_id=%s", (u["user_id"],))])


@bp.put("/api/favorites/<int:pid>")
def set_fav(pid):
    u, e = need("adopter")
    if e:
        return e
    if not query("SELECT 1 FROM pets WHERE pet_id=%s", (pid,), one=True):
        return err("Not found.", 404)
    if body().get("saved"):
        execute("INSERT IGNORE INTO favorites (user_id, pet_id) VALUES (%s, %s)", (u["user_id"], pid))
    else:
        execute("DELETE FROM favorites WHERE user_id=%s AND pet_id=%s", (u["user_id"], pid))
    return jsonify(ok=True)


@bp.get("/api/donations")
def donation_total():
    return jsonify(total=int(query("SELECT COALESCE(SUM(amount), 0) AS t FROM donations", one=True)["t"]))


@bp.get("/api/shelters")
def shelters():
    rows = query("SELECT shelter_id AS id, name, address, lat, lng FROM shelters ORDER BY shelter_id")
    for r in rows:
        r["lat"], r["lng"] = (float(r["lat"]) if r["lat"] is not None else None), (float(r["lng"]) if r["lng"] is not None else None)
    caps = {}
    for c in query("SELECT shelter_id, species, capacity FROM shelter_capacity"):
        caps.setdefault(c["shelter_id"], {})[c["species"]] = c["capacity"]
    for r in rows:
        r["caps"] = caps.get(r["id"], {})
    return jsonify(shelters=rows)
