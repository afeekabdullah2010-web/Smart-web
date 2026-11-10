-- App-only customer identities. Existing website/Admin/Staff roles are unchanged.
CREATE TABLE sp_mobile_clients (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at BIGINT NOT NULL
);
CREATE TABLE sp_mobile_client_sessions (
 token_hash TEXT PRIMARY KEY,
 client_id INTEGER NOT NULL REFERENCES sp_mobile_clients(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL,
 expires_at BIGINT NOT NULL
);
CREATE INDEX sp_mobile_client_sessions_expiry ON sp_mobile_client_sessions(expires_at);
CREATE INDEX sp_mobile_client_requests ON sp_records ((data->>'mobile_client_id')) WHERE kind='consultations';
