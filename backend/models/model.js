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
    return db;
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