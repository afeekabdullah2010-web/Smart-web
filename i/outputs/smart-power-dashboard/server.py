"""Smart Power Engineering Works local server.

Run `python server.py`, then open http://127.0.0.1:8000.
This server intentionally replaces the former browser-only demo password.
"""
from __future__ import annotations

import csv
import io
import datetime
import binascii
import base64
import hashlib
import hmac
import html
import os
import json
import re
import secrets
import sqlite3
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, unquote

ROOT = Path(__file__).resolve().parent
LEGACY_DB = ROOT / "smart_power.db"
# Windows keeps records outside downloaded ZIP folders. An explicit path can be
# supplied for a managed deployment; other platforms keep the existing location.
DB = Path(os.environ["SMART_POWER_DB"]).expanduser().resolve() if os.environ.get("SMART_POWER_DB") else (Path(os.environ["LOCALAPPDATA"]) / "SmartPowerEngineering" / "smart_power.db" if os.name == "nt" and os.environ.get("LOCALAPPDATA") else LEGACY_DB)
APP_VERSION = "2026.11-profile-reports"
HOST, PORT = "127.0.0.1", 8000
SESSION_HOURS = 12
PBKDF2_ROUNDS = 600_000
ADMIN_PAGES = {"admin.html", "projects.html", "team.html", "materials.html", "finance.html", "clients.html", "reports.html", "settings.html"}
ROLE_PAGES = {"staff-dashboard.html": "Staff", "profile.html": None}
DISABLED_PAGES = {"client-dashboard.html"}
ACTIVE_ROLES = {"Admin", "Staff"}
PUBLIC_FILES = {"index.html", "public.js", "public.css", "app.js", "app.css", "auth.css", "i18n.js", "profile.js", "assets/smart-power-logo.png"}


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db


def init_db() -> None:
    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB != LEGACY_DB and not DB.exists() and LEGACY_DB.exists() and not os.environ.get("SMART_POWER_DB"):
        # SQLite backup preserves the existing local users and records on upgrade.
        with sqlite3.connect(LEGACY_DB) as source, sqlite3.connect(DB) as target:
            source.backup(target)
    with connection() as db:
        db.executescript("""
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
              role TEXT NOT NULL CHECK(role IN ('Admin','Staff','Client')),
              password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS profiles (
              user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS records (
              id INTEGER PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL,
              created_by INTEGER, created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
              csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, rounds, salt, digest = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(rounds))
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def esc(value: str) -> str:
    return html.escape(value or "", quote=True)


def page(title: str, body: str) -> bytes:
    return f"""<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{esc(title)} | Smart Power Engineering Works</title><script defer src='/i18n.js'></script><link rel='stylesheet' href='/auth.css'>
<style>body{{background:#061d35;color:#15243a;min-height:100vh;display:grid;place-items:center;margin:0;font-family:Segoe UI,Arial,sans-serif}}.card{{width:min(460px,calc(100% - 36px));box-sizing:border-box;background:white;padding:34px;border-radius:18px;box-shadow:0 22px 60px #0006}}h1{{font-size:28px;margin:0 0 8px}}p{{color:#58677b;line-height:1.5}}label{{display:block;font-weight:700;margin:16px 0 6px}}input,select{{width:100%;box-sizing:border-box;border:1px solid #bed0df;border-radius:9px;padding:12px;font:inherit}}button{{margin-top:22px;width:100%;border:0;border-radius:9px;padding:13px;background:#078ee8;color:#fff;font-weight:800;font:inherit;cursor:pointer}}.language-select{{margin-top:12px;padding:8px;width:auto;max-width:100%}}.brand{{color:#078ee8;font-weight:900;letter-spacing:.08em;font-size:13px}}.error{{background:#fff0f0;color:#9b2020;padding:10px;border-radius:8px}}.note{{font-size:13px}}a{{color:#087ac7}}</style></head><body><main class='card'>{body}</main></body></html>""".encode()


class Handler(SimpleHTTPRequestHandler):
    server_version = "SmartPower/1.0"

    def log_message(self, fmt, *args):
        print("[Smart Power] " + fmt % args)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/auth/setup":
            return self.setup_form()
        if parsed.path == "/auth/login":
            return self.login_form(parse_qs(parsed.query).get("next", [""])[0])
        if parsed.path == "/api/profile":
            return self.profile_api(parsed.query)
        if parsed.path == "/api/support":
            return self.support_api()
        if parsed.path == "/api/admin/reports":
            return self.report_download(parsed.query)
        if parsed.path.startswith("/api/admin/"):
            return self.admin_api(parsed.path)
        if parsed.path == "/api/me":
            return self.api_me()
        if parsed.path == "/admin/users":
            return self.user_management()
        return self.serve_static(parsed.path)

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/profile":
            return self.profile_api(parsed.query)
        if parsed.path == "/api/support":
            return self.support_api()
        if parsed.path.startswith("/api/admin/"):
            return self.admin_api(parsed.path)
        if parsed.path == "/api/consultations":
            return self.consultation_submit()
        if parsed.path == "/auth/setup":
            return self.setup_submit()
        if parsed.path == "/auth/login":
            return self.login_submit()
        if parsed.path == "/auth/logout":
            return self.logout()
        if parsed.path == "/admin/users":
            return self.create_user()
        self.send_error(HTTPStatus.NOT_FOUND)

    def fields(self) -> dict[str, str]:
        length = int(self.headers.get("Content-Length", "0"))
        return {k: v[-1] for k, v in parse_qs(self.rfile.read(length).decode("utf-8"), keep_blank_values=True).items()}

    def session(self):
        cookie = SimpleCookie(self.headers.get("Cookie"))
        raw = cookie.get("sp_session")
        if not raw:
            return None
        with connection() as db:
            row = db.execute("""SELECT s.csrf_token,u.id,u.name,u.email,u.role FROM sessions s
                JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.role IN ('Admin','Staff')""",
                             (token_hash(raw.value), int(time.time()))).fetchone()
        return row

    def require(self, role: str | None = None):
        s = self.session()
        if not s:
            self.redirect("/auth/login?" + urlencode({"next": self.path}))
            return None
        if role and s["role"] not in {role, "Admin"}:
            self.send_error(HTTPStatus.FORBIDDEN, "This account is not authorised for this page.")
            return None
        return s

    def csrf_ok(self, fields: dict[str, str], session) -> bool:
        return bool(session) and hmac.compare_digest(fields.get("csrf", ""), session["csrf_token"])

    def has_admin(self) -> bool:
        with connection() as db:
            return db.execute("SELECT 1 FROM users WHERE role='Admin'").fetchone() is not None

    def send_bytes(self, data: bytes, content_type="text/html; charset=utf-8", status=200, cookie=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def redirect(self, path: str, cookie=None):
        self.send_response(HTTPStatus.SEE_OTHER); self.send_header("Location", path)
        if cookie: self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def setup_form(self, error=""):
        if self.has_admin(): return self.redirect("/auth/login")
        msg = f"<p class='error'>{esc(error)}</p>" if error else ""
        self.send_bytes(page("Create Admin Account", f"""<div class='brand'>SMART POWER ENGINEERING WORKS</div><h1>Set up Admin access</h1><p>Create the first protected administrator account. Passwords are hashed; no fixed password is stored in the website.</p>{msg}
<form method='post'><label>Full name<input name='name' required maxlength='100' autocomplete='name'></label><label>Email<input type='email' name='email' required maxlength='160' autocomplete='email'></label><label>Strong password<input type='password' name='password' required minlength='12' autocomplete='new-password'></label><button>Create secure Admin account</button></form><p class='note'>Use at least 12 characters. Keep this password private.</p>"""))

    def setup_submit(self):
        if self.has_admin(): return self.redirect("/auth/login")
        f = self.fields(); name, email, password = f.get("name", "").strip(), f.get("email", "").strip().lower(), f.get("password", "")
        if len(name) < 2 or "@" not in email or len(password) < 12:
            return self.setup_form("Enter a name, valid email, and a password with at least 12 characters.")
        try:
            with connection() as db:
                db.execute("INSERT INTO users(name,email,role,password_hash,created_at) VALUES(?,?,?,?,?)", (name, email, "Admin", hash_password(password), int(time.time())))
        except sqlite3.IntegrityError:
            return self.setup_form("This email is already registered.")
        self.redirect("/auth/login")

    def login_form(self, next_path="", error="", position="Admin"):
        if not self.has_admin(): return self.redirect("/auth/setup")
        safe_next = next_path if next_path.startswith("/") and not next_path.startswith("//") else ""
        msg = f"<p class='error'>{esc(error)}</p>" if error else ""
        self.send_bytes(page("Secure sign in", f"""<div class='brand'>SMART POWER ENGINEERING WORKS</div><h1>Secure sign in</h1><p>Use your company account to enter the correct workspace.</p>{msg}
<form method='post'><input type='hidden' name='next' value='{esc(safe_next)}'><label>Position<select name='position' required><option value='Admin' {'selected' if position == 'Admin' else ''}>Admin</option><option value='Staff' {'selected' if position == 'Staff' else ''}>Staffs</option></select></label><label>Email<input type='email' name='email' required autocomplete='email'></label><label>Password<input type='password' name='password' required autocomplete='current-password'></label><button>Sign in securely</button></form><p class='note'><a href='/'>Back to company website</a></p>"""))

    def login_submit(self):
        f = self.fields(); email, password = f.get("email", "").strip().lower(), f.get("password", "")
        with connection() as db:
            user = db.execute("SELECT * FROM users WHERE email=? AND active=1", (email,)).fetchone()
        if not user or f.get("position") != user["role"] or user["role"] not in ACTIVE_ROLES or not verify_password(password, user["password_hash"]):
            return self.login_form(f.get("next", ""), "Incorrect position, email or password.", f.get("position", "Admin"))
        raw = secrets.token_urlsafe(32); csrf = secrets.token_urlsafe(24)
        with connection() as db:
            db.execute("DELETE FROM sessions WHERE expires_at<?", (int(time.time()),))
            db.execute("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)", (token_hash(raw), user["id"], csrf, int(time.time()) + SESSION_HOURS * 3600))
        target = f.get("next", "")
        role_targets = {"Admin": set("/" + p for p in ADMIN_PAGES | set(ROLE_PAGES)), "Staff": {"/staff-dashboard.html"}}
        if target not in role_targets[user["role"]]:
            target = {"Admin": "/admin.html", "Staff": "/staff-dashboard.html"}.get(user["role"], "/")
        cookie = f"sp_session={raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_HOURS * 3600}"
        self.redirect(target, cookie)

    def logout(self):
        account = self.session()
        fields = self.fields()
        if account and not self.csrf_ok(fields, account):
            return self.json_response({"error": "Refresh and try again."}, 403)
        cookie = SimpleCookie(self.headers.get("Cookie")); raw = cookie.get("sp_session")
        if raw:
            with connection() as db:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(raw.value),))
        self.redirect("/", "sp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")

    def api_me(self):
        s = self.require()
        if not s: return
        import json
        self.send_bytes(json.dumps({"id": s["id"], "name": s["name"], "email": s["email"], "role": s["role"], "csrf": s["csrf_token"], "version": APP_VERSION}).encode(), "application/json; charset=utf-8")

    def user_management(self):
        s = self.require("Admin")
        if not s: return
        with connection() as db: users = db.execute("SELECT name,email,role,active FROM users ORDER BY role,name").fetchall()
        rows = "".join(f"<tr><td>{esc(u['name'])}</td><td>{esc(u['email'])}</td><td>{esc(u['role'])}</td><td>{'Active' if u['active'] else 'Inactive'}</td></tr>" for u in users)
        self.send_bytes(page("User management", f"""<div class='brand'>SMART POWER · ADMIN</div><h1>Secure user management</h1><p>Create Staff accounts and control company access. Client portal access is currently disabled.</p><form method='post'><input type='hidden' name='csrf' value='{esc(s['csrf_token'])}'><label>Name<input name='name' required></label><label>Email<input type='email' name='email' required></label><label>Role<select name='role'><option>Staff</option><option>Admin</option></select></label><label>Temporary password<input type='password' name='password' minlength='12' required></label><button>Create account</button></form><p class='note'><a href='/admin.html'>Return to Admin Control Centre</a></p><table style='width:100%;margin-top:24px;border-collapse:collapse'><tr><th align='left'>Name</th><th align='left'>Email</th><th align='left'>Role</th><th align='left'>Status</th></tr>{rows}</table>"""))

    def create_user(self):
        s = self.require("Admin")
        if not s: return
        f = self.fields()
        if not self.csrf_ok(f, s):
            self.send_error(HTTPStatus.FORBIDDEN, "Security token invalid. Refresh and try again."); return
        name, email, role, password = f.get("name", "").strip(), f.get("email", "").strip().lower(), f.get("role", ""), f.get("password", "")
        if len(name) < 2 or "@" not in email or role not in {"Admin", "Staff"} or len(password) < 12:
            self.send_error(HTTPStatus.BAD_REQUEST, "Enter valid details; passwords need at least 12 characters."); return
        try:
            with connection() as db: db.execute("INSERT INTO users(name,email,role,password_hash,created_at) VALUES(?,?,?,?,?)", (name,email,role,hash_password(password),int(time.time())))
        except sqlite3.IntegrityError:
            self.send_error(HTTPStatus.CONFLICT, "This email already has an account."); return
        self.redirect("/admin/users")

    def json_response(self, value, status=200):
        self.send_bytes(json.dumps(value, ensure_ascii=False).encode(), "application/json; charset=utf-8", status)

    def json_input(self, limit=65536):
        size = int(self.headers.get("Content-Length", "0"))
        if size < 1 or size > limit:
            raise ValueError("Request size is invalid.")
        value = json.loads(self.rfile.read(size).decode())
        if not isinstance(value, dict):
            raise ValueError("Expected an object.")
        return value

    def add_record(self, db, kind, data, owner):
        return db.execute("INSERT INTO records(kind,data,created_by,created_at) VALUES(?,?,?,?)",
                          (kind, json.dumps(data, ensure_ascii=False), owner, int(time.time()))).lastrowid

    def consultation_submit(self):
        try:
            data = self.json_input()
            cleaned = {k: str(data.get(k, "")).strip()[:2000] for k in ("name", "phone", "type", "message")}
            if not all(cleaned.values()) or len(cleaned["phone"]) < 7:
                raise ValueError("Complete your name, phone number and project details.")
            with connection() as db:
                self.add_record(db, "consultations", cleaned, None)
                self.add_record(db, "notifications", {"name": "New consultation request", "details": cleaned["name"], "status": "Unread"}, None)
            self.json_response({"ok": True}, 201)
        except (ValueError, UnicodeError):
            self.json_response({"error": "Complete valid consultation details."}, 400)

    def admin_api(self, path):
        account = self.require("Admin")
        if not account:
            return
        kind = path.removeprefix("/api/admin/")
        schemas = {
            "projects": {"name": "required", "code": "required", "client": "required", "location": "required", "type": ["Residential", "Commercial", "Engineering", "Renovation"], "status": ["Planned", "In progress", "On hold", "Completed"], "start": "date", "end": "date", "budget": "number", "progress": "percent", "manager": "text", "notes": "text"},
            "team": {"name": "required", "email": "email", "phone": "required", "role": "required", "site": "text", "salary": "number", "status": ["Active", "On leave", "Inactive"]},
            "materials": {"name": "required", "quantity": "number", "unit": "required", "location": "required", "supplier": "text", "minimum": "number", "status": ["Requested", "Ordered", "Received"]},
            "invoices": {"name": "required", "client": "required", "project": "text", "amount": "number", "due": "date", "status": ["Draft", "Pending", "Paid", "Overdue"], "notes": "text"},
            "clients": {"name": "required", "email": "email", "phone": "required", "address": "text", "project": "text", "notes": "text"},
            "attendance": {"name": "required", "date": "date", "site": "text", "hours": "hours", "status": ["Present", "Absent", "Leave"]},
            "notifications": {"name": "required", "details": "text", "status": ["Unread", "Read"]},
            "consultations": {"name": "required", "phone": "required", "type": "required", "message": "required", "status": ["New", "Contacted", "Closed"]},
            "support": {"name": "required", "requester": "required", "email": "email", "message": "required", "status": ["Open", "In progress", "Resolved"], "response": "text"},
            "settings": {"name": "required", "address": "text", "phone": "required", "email": "text"}
        }
        if kind == "users":
            return self.users_api(account)
        if kind not in schemas:
            return self.json_response({"error": "Unknown workspace."}, 404)
        if self.command in {"GET", "HEAD"}:
            with connection() as db:
                rows = db.execute("SELECT * FROM records WHERE kind=? ORDER BY id DESC", (kind,)).fetchall()
            return self.json_response([dict(json.loads(row["data"]), id=row["id"], created_at=row["created_at"]) for row in rows])
        try:
            payload = self.json_input()
            if not self.csrf_ok(payload, account):
                return self.json_response({"error": "Refresh and try again."}, 403)
            record_id = payload.get("id")
            action = payload.get("action", "save")
            with connection() as db:
                if record_id and not db.execute("SELECT 1 FROM records WHERE id=? AND kind=?", (record_id, kind)).fetchone():
                    return self.json_response({"error": "Record not found."}, 404)
                if action == "delete":
                    if not record_id:
                        raise ValueError("Select a record.")
                    db.execute("DELETE FROM records WHERE id=? AND kind=?", (record_id, kind))
                elif action == "save":
                    source = payload.get("data", {})
                    if not isinstance(source, dict):
                        raise ValueError("Invalid record.")
                    data = {}
                    for key, rule in schemas[kind].items():
                        val = str(source.get(key, "")).strip()
                        if len(val) > 2000:
                            raise ValueError(key + " is too long.")
                        if rule == "required" and not val:
                            raise ValueError(key + " is required.")
                        if isinstance(rule, list) and val not in rule:
                            raise ValueError("Choose a valid " + key + ".")
                        if rule in ("number", "percent", "hours"):
                            num = float(val)
                            if not 0 <= num <= (100 if rule == "percent" else 24 if rule == "hours" else 1e12):
                                raise ValueError("Enter a valid " + key + ".")
                            data[key] = num
                            continue
                        if rule == "date":
                            import datetime
                            datetime.date.fromisoformat(val)
                        if rule == "email" and val and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", val):
                            raise ValueError("Enter a valid email.")
                        data[key] = val
                    if kind == "projects" and data["end"] < data["start"]:
                        raise ValueError("End date must be on or after start date.")
                    if record_id:
                        db.execute("UPDATE records SET data=? WHERE id=? AND kind=?", (json.dumps(data, ensure_ascii=False), record_id, kind))
                    else:
                        if kind == "settings":
                            db.execute("DELETE FROM records WHERE kind='settings'")
                        record_id = self.add_record(db, kind, data, account["id"])
                    if kind != "notifications":
                        self.add_record(db, "notifications", {"name": kind.title() + " saved", "details": data.get("name", ""), "status": "Unread"}, account["id"])
                else:
                    raise ValueError("Unknown action.")
            self.json_response({"ok": True, "id": record_id})
        except (ValueError, TypeError, UnicodeError):
            self.json_response({"error": "Check required fields, dates and non-negative amounts; project end must follow start."}, 400)

    def users_api(self, account):
        if self.command in {"GET", "HEAD"}:
            with connection() as db:
                rows = db.execute("SELECT id,name,email,role,active FROM users ORDER BY name").fetchall()
            return self.json_response([dict(row) for row in rows])
        try:
            payload = self.json_input()
            if not self.csrf_ok(payload, account):
                return self.json_response({"error": "Refresh and try again."}, 403)
            uid = int(payload.get("id", 0))
            data = payload.get("data", {})
            name, email, role = str(data.get("name", "")).strip(), str(data.get("email", "")).strip().lower(), data.get("role")
            active = 1 if data.get("active") == "Active" else 0
            password = data.get("password", "")
            if len(name) < 2 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or role not in ACTIVE_ROLES or ((not uid or password) and len(password) < 12):
                raise ValueError("Valid name, email, role and 12-character password required.")
            with connection() as db:
                if uid:
                    if not db.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
                        return self.json_response({"error": "Account not found."}, 404)
                    if uid == account["id"] and (role != "Admin" or not active):
                        raise ValueError("You cannot disable or demote your own account.")
                    db.execute("UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?", (name,email,role,active,uid))
                    if password:
                        db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(password),uid))
                    db.execute("DELETE FROM sessions WHERE user_id=? AND user_id!=?", (uid,account["id"]))
                else:
                    uid = db.execute("INSERT INTO users(name,email,role,password_hash,active,created_at) VALUES(?,?,?,?,?,?)", (name,email,role,hash_password(password),active,int(time.time()))).lastrowid
            self.json_response({"ok": True, "id": uid})
        except (ValueError, TypeError, sqlite3.IntegrityError):
            self.json_response({"error": "Check name, unique email, role and password (12+ characters). Your own Admin account must stay active."}, 400)

    def report_download(self, query):
        account = self.require("Admin")
        if not account:
            return
        params = parse_qs(query)
        kind = params.get("kind", [""])[0]
        columns = {
            "projects": ["name", "code", "client", "location", "type", "status", "start", "end", "budget", "progress", "manager", "notes"],
            "team": ["name", "email", "phone", "role", "site", "salary", "status"],
            "attendance": ["name", "date", "site", "hours", "status"],
            "materials": ["name", "quantity", "unit", "location", "supplier", "minimum", "status"],
            "invoices": ["name", "client", "project", "amount", "due", "status", "notes"],
            "clients": ["name", "email", "phone", "address", "project", "notes"],
            "consultations": ["name", "phone", "type", "message", "status"]
        }
        if kind not in columns:
            return self.json_response({"error": "Choose a report."}, 400)
        try:
            start, end = params.get("from", [""])[0], params.get("to", [""])[0]
            for value in (start, end):
                if value:
                    datetime.date.fromisoformat(value)
            if start and end and start > end:
                raise ValueError()
        except ValueError:
            return self.json_response({"error": "Enter a valid date range."}, 400)
        with connection() as db:
            rows = db.execute("SELECT id,data,created_at FROM records WHERE kind=? ORDER BY id DESC", (kind,)).fetchall()
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["id"] + columns[kind] + ["created_at"])
        for row in rows:
            date = datetime.datetime.fromtimestamp(row["created_at"], datetime.timezone(datetime.timedelta(hours=5, minutes=30))).date().isoformat()
            if (start and date < start) or (end and date > end):
                continue
            data = json.loads(row["data"])
            def safe(value):
                text = str(value if value is not None else "")
                return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")) else text
            writer.writerow([row["id"]] + [safe(data.get(key, "")) for key in columns[kind]] + [date])
        body = ("\ufeff" + output.getvalue()).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="smart-power-{kind}.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def profile_api(self, query):
        account = self.require()
        if not account:
            return
        try:
            user_id = int(parse_qs(query).get("user", [account["id"]])[0])
        except (ValueError, TypeError):
            return self.json_response({"error": "Invalid account."}, 400)
        if user_id != account["id"] and account["role"] != "Admin":
            return self.json_response({"error": "You can access only your own profile."}, 403)
        with connection() as db:
            user = db.execute("SELECT id,name,email,role FROM users WHERE id=? AND role IN ('Admin','Staff')", (user_id,)).fetchone()
            saved = db.execute("SELECT data FROM profiles WHERE user_id=?", (user_id,)).fetchone()
        if not user:
            return self.json_response({"error": "Account not found."}, 404)
        existing = json.loads(saved["data"]) if saved else {}
        if self.command in {"GET", "HEAD"}:
            return self.json_response(dict(existing, **dict(user)))
        try:
            payload = self.json_input(1500000)
            if not self.csrf_ok(payload, account):
                return self.json_response({"error": "Refresh and try again."}, 403)
            data = payload.get("data")
            if not isinstance(data, dict):
                raise ValueError("Invalid profile.")
            allowed = {"name", "email", "phone", "nic", "dob", "address", "employee_id", "department", "job_title", "employment_type", "joined", "emergency_name", "emergency_phone", "blood_group", "qualifications", "bank_name", "bank_account", "photo", "signature"}
            if set(data) - allowed:
                raise ValueError("Unsupported profile fields.")
            profile = dict(existing)
            for key, value in data.items():
                if not isinstance(value, str):
                    raise ValueError("Invalid profile details.")
                value = value.strip()
                if key in {"photo", "signature"}:
                    if value:
                        match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)", value)
                        if not match:
                            raise ValueError("Upload a PNG, JPEG or WebP image.")
                        binary = base64.b64decode(match[2], validate=True)
                        valid = {"png": binary.startswith(b"\x89PNG\r\n\x1a\n"), "jpeg": binary.startswith(b"\xff\xd8\xff"), "webp": binary.startswith(b"RIFF") and binary[8:12] == b"WEBP"}
                        if not valid[match[1]] or len(binary) > 512000:
                            raise ValueError("Each image must be valid and smaller than 500 KB.")
                else:
                    if len(value) > (2000 if key in {"address", "qualifications"} else 200):
                        raise ValueError("Profile field is too long.")
                    if key in {"dob", "joined"} and value:
                        date = datetime.date.fromisoformat(value)
                        if key == "dob" and date > datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).date():
                            raise ValueError("Date of birth cannot be in the future.")
                    if key in {"phone", "emergency_phone"} and value and not re.fullmatch(r"[+0-9 ()-]{7,30}", value):
                        raise ValueError("Enter a valid phone number.")
                profile[key] = value
            name = profile.pop("name", user["name"]).strip()
            email = profile.pop("email", user["email"]).strip().lower()
            if len(name) < 2 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                raise ValueError("Enter a valid name and email.")
            with connection() as db:
                db.execute("UPDATE users SET name=?,email=? WHERE id=?", (name,email,user_id))
                db.execute("INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at", (user_id,json.dumps(profile,ensure_ascii=False),int(time.time())))
            return self.json_response({"ok": True})
        except sqlite3.IntegrityError:
            return self.json_response({"error": "This email is already used by another account."}, 409)
        except (ValueError, TypeError, binascii.Error) as error:
            return self.json_response({"error": str(error) or "Check profile details."}, 400)

    def support_api(self):
        account = self.require()
        if not account:
            return
        if self.command in {"GET", "HEAD"}:
            with connection() as db:
                row = db.execute("SELECT data FROM records WHERE kind='settings' ORDER BY id DESC LIMIT 1").fetchone()
                requests = db.execute("SELECT id,data,created_at FROM records WHERE kind='support' AND created_by=? ORDER BY id DESC", (account["id"],)).fetchall()
            company = json.loads(row["data"]) if row else {}
            return self.json_response({"phone": company.get("phone") or "0773587109", "email": company.get("email", ""), "requests": [dict(json.loads(r["data"]),id=r["id"],created_at=r["created_at"]) for r in requests]})
        try:
            payload = self.json_input()
            if not self.csrf_ok(payload, account):
                return self.json_response({"error": "Refresh and try again."}, 403)
            subject, message = str(payload.get("subject", "")).strip(), str(payload.get("message", "")).strip()
            if not 2 <= len(subject) <= 200 or not 5 <= len(message) <= 2000:
                raise ValueError()
            with connection() as db:
                rid = self.add_record(db,"support",{"name":subject,"message":message,"requester":account["name"],"email":account["email"],"status":"Open","response":""},account["id"])
                self.add_record(db,"notifications",{"name":"Office support request","details":account["name"]+": "+subject,"status":"Unread"},account["id"])
            return self.json_response({"ok":True,"id":rid},201)
        except (ValueError, TypeError):
            return self.json_response({"error":"Enter a subject and a message (5–2000 characters)."},400)

    def serve_static(self, raw_path: str):
        # Resolve decoded paths before checking permissions so alternate URL spellings
        # cannot bypass role guards. Serve only explicitly listed web assets.
        path = (ROOT / unquote(raw_path).lstrip("/")).resolve()
        if path == ROOT:
            path = ROOT / "index.html"
        if ROOT not in path.parents:
            self.send_error(HTTPStatus.NOT_FOUND); return
        name = path.relative_to(ROOT).as_posix()
        if name not in PUBLIC_FILES | ADMIN_PAGES | set(ROLE_PAGES):
            self.send_error(HTTPStatus.NOT_FOUND); return
        if name in DISABLED_PAGES:
            self.send_error(HTTPStatus.NOT_FOUND); return
        if name in ADMIN_PAGES:
            if not self.require("Admin"): return
        elif name in ROLE_PAGES:
            if not self.require(ROLE_PAGES[name]): return
        path = (ROOT / name).resolve()
        if ROOT not in path.parents and path != ROOT:
            self.send_error(HTTPStatus.NOT_FOUND); return
        if not path.is_file(): self.send_error(HTTPStatus.NOT_FOUND); return
        content_type = self.guess_type(str(path)) or "application/octet-stream"
        self.send_bytes(path.read_bytes(), content_type)


if __name__ == "__main__":
    init_db()
    print(f"Smart Power secure server running at http://{HOST}:{PORT}")
    print(f"Permanent database: {DB}")
    print("First run: create an Admin at http://127.0.0.1:8000/auth/setup")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
