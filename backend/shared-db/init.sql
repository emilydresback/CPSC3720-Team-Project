-- init.sql
-- Defines the structure of the shared SQLite database
-- Creates the 'events' table used by both the Admin and Client microservices

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_tickets INTEGER NOT NULL CHECK(total_tickets >= 0)
);
