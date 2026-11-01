"""Smart Power Engineering Works local server.

Run `python server.py`, then open http://127.0.0.1:8000.
This server intentionally replaces the former browser-only demo password.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import os
import secrets
import sqlite3
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

ROOT = Path(__file__).resolve().parent
DB = ROOT / "smart_power.db"
HOST, PORT = "127.0.0.1", 8000
SESSION_HOURS = 12
PBKDF2_ROUNDS = 600_000
ADMIN_PAGES = {"admin.html", "projects.html", "team.html", "materials.html", "finance.html", "clients.html", "reports.html", "settings.html"}
ROLE_PAGES = {"staff-dashboard.html": "Staff"}
DISABLED_PAGES = {"client-dashboard.html"}


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db


def init_db() -> None:
    with connection() as db:
        db.executescript("""
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
              role TEXT NOT NULL CHECK(role IN ('Admin','Staff','Client')),
              password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
              created_at INTEGER NOT NULL
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
<title>{esc(title)} | Smart Power Engineering Works</title><link rel='stylesheet' href='/auth.css'>
<style>body{{background:#061d35;color:#15243a;min-height:100vh;display:grid;place-items:center;margin:0;font-family:Segoe UI,Arial,sans-serif}}.card{{width:min(460px,calc(100% - 36px));box-sizing:border-box;background:white;padding:34px;border-radius:18px;box-shadow:0 22px 60px #0006}}h1{{font-size:28px;margin:0 0 8px}}p{{color:#58677b;line-height:1.5}}label{{display:block;font-weight:700;margin:16px 0 6px}}input,select{{width:100%;box-sizing:border-box;border:1px solid #bed0df;border-radius:9px;padding:12px;font:inherit}}button{{margin-top:22px;width:100%;border:0;border-radius:9px;padding:13px;background:#078ee8;color:#fff;font-weight:800;font:inherit;cursor:pointer}}.brand{{color:#078ee8;font-weight:900;letter-spacing:.08em;font-size:13px}}.error{{background:#fff0f0;color:#9b2020;padding:10px;border-radius:8px}}.note{{font-size:13px}}a{{color:#087ac7}}</style></head><body><main class='card'>{body}</main></body></html>""".encode()


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
        if parsed.path == "/api/me":
            return self.api_me()
        if parsed.path == "/admin/users":
            return self.user_management()
        return self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
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
                JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1""",
                             (token_hash(raw.value), int(time.time()))).fetchone()
        return row

    def require(self, role: str | None = None):
        s = self.session()
        if not s:
            self.redirect("/auth/login?" + urlencode({"next": self.path}))
            return None
        if role and s["role"] != role:
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
        self.end_headers(); self.wfile.write(data)

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

    def login_form(self, next_path="", error=""):
        if not self.has_admin(): return self.redirect("/auth/setup")
        safe_next = next_path if next_path.startswith("/") and not next_path.startswith("//") else ""
        msg = f"<p class='error'>{esc(error)}</p>" if error else ""
        self.send_bytes(page("Secure sign in", f"""<div class='brand'>SMART POWER ENGINEERING WORKS</div><h1>Secure sign in</h1><p>Use your company account to enter the correct workspace.</p>{msg}
<form method='post'><input type='hidden' name='next' value='{esc(safe_next)}'><label>Email<input type='email' name='email' required autocomplete='email'></label><label>Password<input type='password' name='password' required autocomplete='current-password'></label><button>Sign in securely</button></form><p class='note'><a href='/'>Back to company website</a></p>"""))

    def login_submit(self):
        f = self.fields(); email, password = f.get("email", "").strip().lower(), f.get("password", "")
        with connection() as db:
            user = db.execute("SELECT * FROM users WHERE email=? AND active=1", (email,)).fetchone()
        if not user or not verify_password(password, user["password_hash"]):
            return self.login_form(f.get("next", ""), "Incorrect email or password.")
        raw = secrets.token_urlsafe(32); csrf = secrets.token_urlsafe(24)
        with connection() as db:
            db.execute("DELETE FROM sessions WHERE expires_at<?", (int(time.time()),))
            db.execute("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)", (token_hash(raw), user["id"], csrf, int(time.time()) + SESSION_HOURS * 3600))
        target = f.get("next", "")
        role_targets = {"Admin": set("/" + p for p in ADMIN_PAGES), "Staff": {"/staff-dashboard.html"}, "Client": {"/client-dashboard.html"}}
        if target not in role_targets[user["role"]]:
            target = {"Admin": "/admin.html", "Staff": "/staff-dashboard.html"}.get(user["role"], "/")
        cookie = f"sp_session={raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_HOURS * 3600}"
        self.redirect(target, cookie)

    def logout(self):
        s = self.session(); f = self.fields()
        if s and self.csrf_ok(f, s):
            cookie = SimpleCookie(self.headers.get("Cookie")); raw = cookie.get("sp_session")
            if raw:
                with connection() as db: db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(raw.value),))
        self.redirect("/", "sp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")

    def api_me(self):
        s = self.require()
        if not s: return
        import json
        self.send_bytes(json.dumps({"name": s["name"], "email": s["email"], "role": s["role"], "csrf": s["csrf_token"]}).encode(), "application/json; charset=utf-8")

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

    def serve_static(self, raw_path: str):
        name = raw_path.lstrip("/") or "index.html"
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
    print("First run: create an Admin at http://127.0.0.1:8000/auth/setup")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
