CREATE TABLE IF NOT EXISTS chat_read_markers (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_id)
);

INSERT INTO chat_read_markers (user_id, contact_id, last_read_at)
SELECT b.tenant_id, p.host_id, NOW()
FROM bookings b
JOIN places p ON p.id = b.place_id
ON CONFLICT (user_id, contact_id) DO NOTHING;

INSERT INTO chat_read_markers (user_id, contact_id, last_read_at)
SELECT p.host_id, b.tenant_id, NOW()
FROM bookings b
JOIN places p ON p.id = b.place_id
ON CONFLICT (user_id, contact_id) DO NOTHING;
