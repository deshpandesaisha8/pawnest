import io
from datetime import date
from decimal import Decimal

from flask import Blueprint, jsonify, send_file
from PIL import Image, ImageDraw, ImageFont

from db import execute, pool, query
from api_core import body, err, log, need, notify

bp5 = Blueprint("extras", __name__)
RECORD_TYPES = ("Vaccination", "Checkup", "Treatment", "Surgery")


def clean(rows):
    for r in rows:
        for k, v in r.items():
            if isinstance(v, Decimal):
                r[k] = int(v) if v == v.to_integral() else float(v)
            elif isinstance(v, date):
                r[k] = v.isoformat()
    return rows


@bp5.get("/api/reports")
def reports():
    u, e = need("admin")
    if e:
        return e
    return jsonify(
        shelters=clean(query("SELECT name, total, adopted, rate FROM v_shelter_stats ORDER BY rate DESC")),  # view defined in sql/08
        breeds=clean(query(
            "SELECT p.breed, COUNT(*) AS apps FROM applications a JOIN pets p ON p.pet_id = a.pet_id "
            "GROUP BY p.breed HAVING COUNT(*) >= 1 ORDER BY apps DESC, p.breed LIMIT 6")),
        longest=clean(query(
            "SELECT species, name, days FROM (SELECT species, name, DATEDIFF(CURDATE(), intake_date) AS days, "
            "RANK() OVER (PARTITION BY species ORDER BY intake_date) AS rnk FROM pets WHERE status='Available') t "
            "WHERE rnk <= 3 ORDER BY species, days DESC")),
        species=clean(query("SELECT species, COUNT(*) AS n FROM pets WHERE status <> 'Adopted' GROUP BY species")),
        monthly=clean(query("SELECT YEAR(created_at) AS y, MONTH(created_at) AS mo, COUNT(*) AS n FROM applications GROUP BY y, mo ORDER BY y, mo LIMIT 12")),
        funnel=clean(query("SELECT status, COUNT(*) AS n FROM applications GROUP BY status")),
        rating=clean(query("SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS answered FROM followups WHERE status='Done'"))[0])


@bp5.get("/api/matches")
def matches():
    u, e = need("adopter")
    if e:
        return e
    con = pool().get_connection()
    cur = con.cursor(dictionary=True)
    try:
        cur.callproc("sp_match_pets", (u["user_id"],))  # the ranking is calculated inside MySQL
        rows = [r for res in cur.stored_results() for r in res.fetchall()]
    finally:
        cur.close()
        con.close()
    return jsonify(matches=clean(rows))


# ---------- waitlist ----------
@bp5.get("/api/waitlist")
def get_waitlist():
    u, e = need("adopter")
    if e:
        return e
    return jsonify(waitlist=query(
        "SELECT pet_id, pos FROM (SELECT user_id, pet_id, ROW_NUMBER() OVER (PARTITION BY pet_id ORDER BY joined_at, user_id) AS pos "
        "FROM waitlist) t WHERE user_id=%s", (u["user_id"],)))


@bp5.post("/api/waitlist/<int:pid>")
def set_waitlist(pid):
    u, e = need("adopter")
    if e:
        return e
    pet = query("SELECT status FROM pets WHERE pet_id=%s", (pid,), one=True)
    if not pet or pet["status"] != "Quarantine":
        return err("This animal is not waiting for release.", 409)
    if body().get("on"):
        execute("INSERT IGNORE INTO waitlist (user_id, pet_id) VALUES (%s, %s)", (u["user_id"], pid))
    else:
        execute("DELETE FROM waitlist WHERE user_id=%s AND pet_id=%s", (u["user_id"], pid))
    return jsonify(ok=True)


@bp5.post("/api/pets/<int:pid>/release")
def release(pid):
    u, e = need("admin")
    if e:
        return e
    pet = query("SELECT name, status FROM pets WHERE pet_id=%s", (pid,), one=True)
    if not pet or pet["status"] != "Quarantine":
        return err("That animal is not in quarantine.", 409)
    execute("UPDATE pets SET status='Available' WHERE pet_id=%s", (pid,))  # the trigger notifies the waitlist
    log(u["user_id"], f"Released {pet['name']} from quarantine")
    return jsonify(ok=True)


# ---------- medical history ----------
@bp5.get("/api/pets/<int:pid>/records")
def get_records(pid):
    u, e = need()
    if e:
        return e
    rows = query("SELECT r.record_type AS type, r.notes, r.next_due, DATE(r.recorded_at) AS date, COALESCE(u.full_name, '') AS by_name "
                 "FROM medical_records r LEFT JOIN users u ON u.user_id = r.recorded_by WHERE r.pet_id=%s "
                 "ORDER BY r.recorded_at DESC, r.record_id DESC", (pid,))
    return jsonify(records=clean(rows))


@bp5.post("/api/pets/<int:pid>/records")
def add_record(pid):
    u, e = need(("admin", "vet"))
    if e:
        return e
    b = body()
    pet = query("SELECT name FROM pets WHERE pet_id=%s", (pid,), one=True)
    notes, kind, due = str(b.get("notes", "")).strip(), b.get("type"), str(b.get("next_due") or "")
    if not pet or kind not in RECORD_TYPES or not 3 <= len(notes) <= 200:
        return err("Pick a type and add a short note.")
    try:
        due = date.fromisoformat(due).isoformat() if due else None
    except ValueError:
        return err("That due date is not valid.")
    execute("INSERT INTO medical_records (pet_id, record_type, notes, next_due, recorded_by) VALUES (%s,%s,%s,%s,%s)",
            (pid, kind, notes, due, u["user_id"]))
    if kind == "Vaccination":
        execute("UPDATE pets SET vaccinated=1 WHERE pet_id=%s", (pid,))
    log(u["user_id"], f"Added a {kind.lower()} record for {pet['name']}")
    return jsonify(ok=True), 201


# ---------- post-adoption follow-ups ----------
@bp5.get("/api/followups")
def followups():
    u, e = need()
    if e:
        return e
    sql = ("SELECT f.followup_id AS id, p.name AS pet, u.full_name AS who, f.days_after, f.due_date, f.status, f.rating, f.notes "
           "FROM followups f JOIN applications a ON a.application_id = f.application_id "
           "JOIN pets p ON p.pet_id = a.pet_id JOIN users u ON u.user_id = a.user_id")
    if u["role"] == "admin":
        rows = query(sql + " ORDER BY f.due_date, f.followup_id")
    else:
        rows = query(sql + " WHERE a.user_id=%s ORDER BY f.due_date, f.followup_id", (u["user_id"],))
    return jsonify(followups=clean(rows))


@bp5.post("/api/followups/<int:fid>")
def answer_followup(fid):
    u, e = need("adopter")
    if e:
        return e
    f = query("SELECT f.status, p.name FROM followups f JOIN applications a ON a.application_id = f.application_id "
              "JOIN pets p ON p.pet_id = a.pet_id WHERE f.followup_id=%s AND a.user_id=%s", (fid, u["user_id"]), one=True)
    b = body()
    try:
        rating = int(b.get("rating"))
    except (TypeError, ValueError):
        rating = 0
    if not f or f["status"] != "Pending" or not 1 <= rating <= 5:
        return err("That check-in is not available.", 409)
    execute("UPDATE followups SET status='Done', rating=%s, notes=%s, done_at=NOW() WHERE followup_id=%s",
            (rating, str(b.get("notes", "")).strip()[:150], fid))
    notify(f"{u['full_name']} sent a check-in for {f['name']} (rating {rating}/5)", admin=True)
    log(u["user_id"], f"Submitted a follow-up for {f['name']}")
    return jsonify(ok=True)


# ---------- adoption certificate (PDF) ----------
@bp5.get("/api/applications/<int:aid>/certificate")
def certificate(aid):
    u, e = need()
    if e:
        return e
    r = query("SELECT a.application_id, a.user_id, a.status, u.full_name AS adopter, p.name AS pet, p.breed, s.name AS shelter "
              "FROM applications a JOIN users u ON u.user_id = a.user_id JOIN pets p ON p.pet_id = a.pet_id "
              "JOIN shelters s ON s.shelter_id = p.shelter_id WHERE a.application_id=%s", (aid,), one=True)
    if not r or r["status"] != "Approved" or (u["role"] != "admin" and r["user_id"] != u["user_id"]):
        return err("Not found.", 404)
    W, H = 1754, 1240
    img = Image.new("RGB", (W, H), "#fffaf0")
    d = ImageDraw.Draw(img)
    d.rectangle((40, 40, W - 40, H - 40), outline="#1f7f86", width=10)
    d.rectangle((70, 70, W - 70, H - 70), outline="#e0892b", width=3)

    def line(y, text, size, fill="#222222"):
        f = ImageFont.load_default(size=size)
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)

    line(170, "PAWNEST", 70, "#1f7f86")
    line(290, "Certificate of Adoption", 120)
    line(520, "This certifies that", 48, "#555555")
    line(600, r["adopter"], 96, "#1f7f86")
    line(760, f"has adopted {r['pet']} the {r['breed']}", 56)
    line(850, f"from {r['shelter']}", 48, "#555555")
    line(1010, f"Issued {date.today():%d %B %Y}     Certificate no. PN-{aid:05d}", 40, "#777777")
    buf = io.BytesIO()
    img.save(buf, "PDF", resolution=150)
    buf.seek(0)
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=f"pawnest-certificate-{aid}.pdf")
