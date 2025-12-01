// File: backend/models/model.js (Update and replace the existing file content)

const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

// NOTE: Adjust the path if necessary
const dbPath = path.resolve(__dirname, '../shared-db/database.sqlite');
let db; 

async function openDb() {
    if (db) return db;

    db = await sqlite.open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    console.log(`[DB] Connected to SQLite database.`);
    
    // Initialize database schema and sample data
    await initializeDatabase();
    
    return db;
}

// Initialize database with schema and sample data
async function initializeDatabase() {
    try {
        // Create events table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                total_tickets INTEGER NOT NULL CHECK(total_tickets >= 0),
                tickets_available INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create users table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Check if we have any events
        const eventCount = await db.get(`SELECT COUNT(*) as count FROM events`);
        
        if (eventCount.count === 0) {
            console.log('[DB] Inserting sample events...');
            await db.exec(`
                INSERT INTO events (name, date, total_tickets, tickets_available) VALUES
                ('Game Night', '2025-10-20', 100, 100),
                ('Concert A', '2025-11-01', 50, 50),
                ('Festival B', '2025-12-05', 200, 200),
                ('Homecoming Tailgate', '2025-11-08', 75, 75),
                ('Student Technology Expo', '2025-12-05', 200, 200);
            `);
            console.log('[DB] Sample events inserted.');
        } else {
            console.log(`[DB] Found ${eventCount.count} existing events.`);
        }
    } catch (error) {
        console.error('[DB] Error initializing database:', error);
    }
}

// 1. GET Events function (Needed for initial load)
async function getEvents() {
    const db = await openDb();
    const sql = `SELECT id, name, date, tickets_available FROM events ORDER BY date ASC`;
    return db.all(sql);
}

// 2. POST Purchase function (CRITICAL: Needed for booking)
async function updateTicketCount(eventId) {
    const db = await openDb();
    
    // Check current availability and total tickets in a single transaction-like manner
    const event = await db.get(
        `SELECT tickets_available FROM events WHERE id = ?`, 
        [eventId]
    );

    if (!event || event.tickets_available <= 0) {
        return { success: false, message: "Ticket sold out or event not found." };
    }

    // Decrement ticket count
    const result = await db.run(
        `UPDATE events SET tickets_available = tickets_available - 1 WHERE id = ? AND tickets_available > 0`,
        [eventId]
    );

    // Check if a row was actually changed (successful purchase)
    if (result.changes === 1) {
         return { success: true, message: "Purchase successful." };
    } else {
         return { success: false, message: "Purchase failed due to race condition or being sold out." };
    }
}

module.exports = { getEvents, updateTicketCount, openDb };