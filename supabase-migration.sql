-- ZAS Sodniki Database Schema for Supabase/PostgreSQL
-- Run this in Supabase SQL Editor

-- Enable UUID extension (optional, but recommended for better IDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Officials table
CREATE TABLE IF NOT EXISTS officials (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  license_number TEXT,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT,
  location TEXT,
  type TEXT,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competition Officials (junction table)
CREATE TABLE IF NOT EXISTS competition_officials (
  id BIGSERIAL PRIMARY KEY,
  competition_id BIGINT REFERENCES competitions(id) ON DELETE CASCADE,
  official_id BIGINT REFERENCES officials(id) ON DELETE CASCADE,
  role TEXT,
  hours REAL,
  notes TEXT
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  official_id BIGINT REFERENCES officials(id) ON DELETE SET NULL,
  competition_id BIGINT REFERENCES competitions(id) ON DELETE SET NULL,
  amount REAL,
  date TEXT,
  method TEXT,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (for app configuration)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_competition_officials_comp ON competition_officials(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_officials_official ON competition_officials(official_id);
CREATE INDEX IF NOT EXISTS idx_payments_official ON payments(official_id);
CREATE INDEX IF NOT EXISTS idx_payments_competition ON payments(competition_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password, name, role)
VALUES ('admin', 'admin123', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert default official roles
INSERT INTO settings (key, value)
VALUES (
  'official_roles',
  '[
    {
      "id": 1,
      "name": "Glavni sodnik",
      "rates": [
        {"from": 0, "to": 6, "rate": 30},
        {"from": 6, "to": 8, "rate": 35},
        {"from": 8, "to": 999, "rate": 40}
      ]
    },
    {
      "id": 2,
      "name": "Pomožni sodnik",
      "rates": [
        {"from": 0, "to": 6, "rate": 25},
        {"from": 6, "to": 8, "rate": 30},
        {"from": 8, "to": 999, "rate": 35}
      ]
    },
    {
      "id": 3,
      "name": "Časomerilec",
      "rates": [
        {"from": 0, "to": 6, "rate": 20},
        {"from": 6, "to": 8, "rate": 25},
        {"from": 8, "to": 999, "rate": 30}
      ]
    }
  ]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Insert default app settings
INSERT INTO settings (key, value)
VALUES ('app_settings', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing authenticated users to access data)
-- For now, we'll allow all authenticated users full access
-- You can refine these later based on user roles

-- Users policies - MUST allow anonymous read for login to work!
CREATE POLICY "Allow anyone to read users for login"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anyone to manage users"
  ON users FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Officials policies (everyone can read, only authenticated can modify)
CREATE POLICY "Allow public read access to officials"
  ON officials FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage officials"
  ON officials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Competitions policies
CREATE POLICY "Allow public read access to competitions"
  ON competitions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage competitions"
  ON competitions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Competition Officials policies
CREATE POLICY "Allow public read access to competition_officials"
  ON competition_officials FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage competition_officials"
  ON competition_officials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payments policies
CREATE POLICY "Allow public read access to payments"
  ON payments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage payments"
  ON payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Settings policies (read-only for most, admins can write)
CREATE POLICY "Allow public read access to settings"
  ON settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
