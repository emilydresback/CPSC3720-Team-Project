// ================================================
// clientModel.js
// ================================================
// This file handles all database operations for the client microservice.
// It interacts directly with the shared SQLite database that stores event data
// (including ticket counts).
//
// Task 5 focuses on database synchronization & concurrency:
// → Preventing race conditions
// → Ensuring ticket counts remain accurate under load
//
// This implementation uses TRANSACTIONS to make sure that either:
// - The entire purchase succeeds (and tickets are deducted properly)
// - Or it fails safely (and the database is rolled back to its previous state)
// ================================================

const sqlite3 = require('sqlite3').verbose(); // SQLite library for Node.js
const path = require('path');

// ------------------------------------------------
// Resolve path to the shared database file
// __dirname = current folder (client-service/models)
// '../../shared-db/database.sqlite' = shared DB location
// ------------------------------------------------
const dbPath = path.join(__dirname, '../../shared-db/database.sqlite');

// ------------------------------------------------
// Connect to the SQLite database
// ------------------------------------------------
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to SQLite DB (client-service)');
  }
});

// Ensure DB schema is compatible: if `tickets_available` column is missing, add it
// and initialize it from `total_tickets`. This avoids requiring a separate script.
db.serialize(() => {
  db.all("PRAGMA table_info(events)", (err, cols) => {
    if (err) {
      console.error('Failed to read table info:', err.message);
      return;
    }
    const hasTicketsAvailable = cols && cols.some(c => c.name === 'tickets_available');
    if (!hasTicketsAvailable) {
      console.log('Migrating DB: adding tickets_available column to events');
      db.run('ALTER TABLE events ADD COLUMN tickets_available INTEGER DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Failed to add tickets_available column:', alterErr.message);
          return;
        }
        db.run('UPDATE events SET tickets_available = total_tickets', (updateErr) => {
          if (updateErr) {
            console.error('Failed to populate tickets_available:', updateErr.message);
            return;
          }
          console.log('DB migration complete: tickets_available populated.');
        });
      });
    }
  });
});

// Set PRAGMA options to help with concurrent writes
db.serialize(() => {
  // Use WAL journal mode for better concurrency
  db.run("PRAGMA journal_mode = WAL");
  // Set a busy timeout so the DB will wait a bit when locked
  db.run("PRAGMA busy_timeout = 5000");
});

// ------------------------------------------------
// FUNCTION: getAllEvents
// ------------------------------------------------
// Purpose: Fetch all available events from the "events" table.
// Input: callback(err, rows)
// Output: an array of event objects (id, name, tickets, etc.)
//
// This function does NOT modify the database, it’s a simple read operation.
// ------------------------------------------------
function getAllEvents(callback) {
   // Select all events from DB
  const query = 'SELECT * FROM events';
  db.all(query, [], (err, rows) => {
    if (err) {
      // Pass error to controller if something goes wrong
      return callback(err);
    }
    // Normalize rows so callers always get a `tickets_available` field
    const normalized = rows.map(r => ({
      ...r,
      tickets_available: r.tickets_available !== undefined && r.tickets_available !== null
        ? r.tickets_available
        : r.total_tickets
    }));
    // Return all events successfully
    callback(null, normalized);
  });
}

// ------------------------------------------------
// FUNCTION: purchaseTickets
// ------------------------------------------------
// Purpose:
// Safely handle ticket purchases by:
//   1. Checking ticket availability
//   2. Preventing overselling
//   3. Updating the database atomically using a TRANSACTION
//
// Logic flow:
//   BEGIN TRANSACTION
//   → SELECT event
//   → Check if enough tickets exist
//   → UPDATE ticket count
//   → COMMIT (save changes)
//   → If any step fails, ROLLBACK (undo changes)
//
// The db.serialize() ensures operations are queued and executed sequentially,
// which avoids concurrent write conflicts within SQLite.
// ------------------------------------------------
function purchaseTickets(eventId, quantity, callback) {
  // Use a single atomic UPDATE to decrement tickets only if enough are available.
  // This avoids explicit BEGIN/COMMIT and prevents nested transaction errors.
  const sql = 'UPDATE events SET tickets_available = tickets_available - ? WHERE id = ? AND tickets_available >= ?';
  db.run(sql, [quantity, eventId, quantity], function (err) {
    if (err) return callback(err);

    // If no rows were updated, not enough tickets were available (or event missing)
    if (this.changes === 0) {
      // Determine whether the event exists or there were insufficient tickets
      db.get('SELECT * FROM events WHERE id = ?', [eventId], (getErr, event) => {
        if (getErr) return callback(getErr);
        if (!event) return callback(new Error('Event not found'));
        return callback(new Error('Not enough tickets available'));
      });
      return;
    }

    // Fetch updated row to return
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (getErr, event) => {
      if (getErr) return callback(getErr);
      const returned = {
        ...event,
        tickets_available: event.tickets_available !== undefined && event.tickets_available !== null
          ? event.tickets_available
          : event.total_tickets,
        message: 'Purchase completed successfully!'
      };
      callback(null, returned);
    });
  });
}

// ------------------------------------------------
// EXPORTS
// ------------------------------------------------
// These functions are imported by the controller (clientController.js)
// which defines the API endpoints that call these DB operations.
// ------------------------------------------------
module.exports = {
  getAllEvents,
  purchaseTickets,
};
