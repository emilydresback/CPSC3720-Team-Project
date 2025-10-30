-- ================================================
-- TigerTix Shared Database Initialization Script
-- ================================================
-- This script creates the shared SQLite database schema
-- and populates it with initial sample events.
--
-- Used by:
--   • admin-service (port 5001) – to create/update events
--   • client-service (port 6001) – to read and purchase tickets
--
-- Run this from the shared-db folder:
--   sqlite3 database.sqlite < init.sql
-- ================================================


-- ------------------------------------------------
-- Drop existing table (optional for resets)
-- ------------------------------------------------
DROP TABLE IF EXISTS events;

-- ------------------------------------------------
-- Create events table
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_tickets INTEGER NOT NULL CHECK(total_tickets >= 0),
    tickets_available INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------
-- Insert initial sample events
-- ------------------------------------------------
INSERT INTO events (name, date, total_tickets, tickets_available) VALUES
('Game Night', '2025-10-20', 100, 100),
('Concert A', '2025-11-01', 50, 50),
('Festival B', '2025-12-05', 200, 200),
('Homecoming Tailgate', '2025-11-08', 75, 75),
('Student Technology Expo', '2025-12-05', 200, 200);

-- ------------------------------------------------
-- Verify table contents
-- ------------------------------------------------
SELECT * FROM events;
