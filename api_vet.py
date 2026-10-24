from flask import Blueprint, jsonify

from db import query
from api_core import need
from api_extras import clean

bp6 = Blueprint("vet", __name__)


@bp6.get("/api/vet/queue")
def vet_queue():
    u, e = need(("admin", "vet"))
    if e:
        return e
    due = query("SELECT r.record_id AS id, p.name AS pet, r.record_type AS type, r.notes, r.next_due "
                "FROM medical_records r JOIN pets p ON p.pet_id = r.pet_id "
                "WHERE r.next_due IS NOT NULL AND r.next_due <= CURDATE() + INTERVAL 30 DAY AND p.status <> 'Adopted' "
                "ORDER BY r.next_due LIMIT 20")
    attention = query("SELECT pet_id AS id, name, breed, vaccinated AS vac, behavior_checked AS beh, under_treatment AS tr "
                      "FROM pets WHERE status <> 'Adopted' AND (vaccinated = 0 OR behavior_checked = 0 OR under_treatment = 1) "
                      "ORDER BY name")
    return jsonify(due=clean(due), attention=clean(attention))
