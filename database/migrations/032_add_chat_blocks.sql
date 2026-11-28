CREATE TABLE IF NOT EXISTS chat_blocks (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_id),
  CHECK (user_id <> contact_id)
);
