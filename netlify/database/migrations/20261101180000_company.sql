CREATE TABLE sp_users (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL CHECK(role IN ('Admin','Staff')),
 password_hash TEXT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at BIGINT NOT NULL
);
CREATE TABLE sp_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES sp_users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL,
 expires_at BIGINT NOT NULL
);
CREATE INDEX sp_sessions_expiry ON sp_sessions(expires_at);
CREATE TABLE sp_records (
 id SERIAL PRIMARY KEY,
 kind TEXT NOT NULL,
 data JSONB NOT NULL,
 created_by INTEGER REFERENCES sp_users(id),
 created_at BIGINT NOT NULL
);
CREATE INDEX sp_records_kind ON sp_records(kind,id);
CREATE UNIQUE INDEX sp_payroll_month ON sp_records ((data->>'user_id'),(data->>'period')) WHERE kind='payroll';
CREATE TABLE sp_profiles (
 user_id INTEGER PRIMARY KEY REFERENCES sp_users(id) ON DELETE CASCADE,
 data JSONB NOT NULL,
 updated_at BIGINT NOT NULL
);
CREATE TABLE sp_attendance (
 id SERIAL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES sp_users(id),
 date TEXT NOT NULL,
 site TEXT NOT NULL,
 check_in BIGINT NOT NULL,
 check_out BIGINT,
 UNIQUE(user_id,date)
);
CREATE UNIQUE INDEX sp_one_open_shift ON sp_attendance(user_id) WHERE check_out IS NULL;
CREATE TABLE sp_uploads (
 key TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES sp_users(id),
 mime TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size<=3500000),
 created_at BIGINT NOT NULL
);
