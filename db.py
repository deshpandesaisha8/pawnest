import os

from flask import session
from mysql.connector import pooling

_pools = {}


def pool():
    """One connection pool per database user. If DB_ADMIN_* / DB_ADOPTER_* are set in .env and
    sql/roles.sql was run, signed-in users query MySQL with that role's limited privileges."""
    kind = None
    try:
        kind = session.get("role")
    except RuntimeError:  # outside a web request
        pass
    user = os.getenv(f"DB_{kind.upper()}_USER") if kind else None
    if user:
        creds = (user, os.getenv(f"DB_{kind.upper()}_PASSWORD", ""))
    else:
        kind, creds = "app", (os.environ["DB_USER"], os.environ["DB_PASSWORD"])
    if kind not in _pools:
        _pools[kind] = pooling.MySQLConnectionPool(
            pool_name="pawnest_" + kind, pool_size=4, host=os.getenv("DB_HOST", "localhost"), port=int(os.getenv("DB_PORT", "3306")),
            user=creds[0], password=creds[1], database=os.environ["DB_NAME"])
    return _pools[kind]


def query(sql, args=(), one=False):
    """SELECT helper. Always pass user input through args (%s), never string-format it."""
    con = pool().get_connection()
    cur = con.cursor(dictionary=True)
    try:
        cur.execute(sql, args)
        rows = cur.fetchall()
        return (rows[0] if rows else None) if one else rows
    finally:
        cur.close()
        con.close()


def execute(sql, args=()):
    """INSERT/UPDATE/DELETE helper. Returns the new row id."""
    con = pool().get_connection()
    cur = con.cursor()
    try:
        cur.execute(sql, args)
        con.commit()
        return cur.lastrowid
    finally:
        cur.close()
        con.close()
