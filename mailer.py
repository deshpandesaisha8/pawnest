"""Optional email and WhatsApp alerts. Everything here is skipped unless SMTP_* / TWILIO_* are set in .env."""
import base64
import os
import smtplib
import threading
import urllib.parse
import urllib.request
from email.message import EmailMessage

from db import query


def _send_email(to, subject, text):
    host = os.getenv("SMTP_HOST")
    if not host or not to:
        return
    msg = EmailMessage()
    msg["Subject"], msg["To"] = subject, to
    msg["From"] = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER", "")
    msg.set_content(text)
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as s:
        s.starttls()
        if os.getenv("SMTP_USER"):
            s.login(os.environ["SMTP_USER"], os.getenv("SMTP_PASSWORD", ""))
        s.send_message(msg)


def _send_whatsapp(phone, text):
    sid, token, sender = os.getenv("TWILIO_SID"), os.getenv("TWILIO_TOKEN"), os.getenv("TWILIO_WHATSAPP_FROM")
    if not (sid and token and sender and phone):
        return
    data = urllib.parse.urlencode({"From": "whatsapp:+" + sender, "To": "whatsapp:+91" + phone, "Body": text}).encode()
    req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=data)
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode())
    urllib.request.urlopen(req, timeout=10)


def _work(text, uid, admin):
    try:
        if admin:
            rows = query("SELECT email, phone FROM users WHERE role='admin'")
        else:
            rows = query("SELECT email, phone FROM users WHERE user_id=%s", (uid,))
        for r in rows:
            for send, to, subject in ((_send_email, r["email"], "Pawnest update"), (_send_whatsapp, r["phone"], None)):
                try:
                    send(to, subject, text) if subject else send(to, "Pawnest: " + text)
                except Exception:
                    pass  # an alert failing must never break the website
    except Exception:
        pass


def alert(text, uid=None, admin=False):
    if os.getenv("SMTP_HOST") or os.getenv("TWILIO_SID"):
        threading.Thread(target=_work, args=(text, uid, admin), daemon=True).start()
