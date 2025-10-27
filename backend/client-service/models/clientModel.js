// clientModel.js
// ================================================
// This file handles all database operations for the client microservice.
// It interacts directly with the shared SQLite database that stores event data
// (including ticket counts).
//
// Task 5 focuses on database synchronization & concurrency:
// - Preventing race conditions
// - Ensuring ticket counts remain accurate under load
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

// ------------------------------------------------
// Database initialization: create events table if it doesn't exist
// Then handle migration for tickets_available column
// ------------------------------------------------
db.serialize(() => {
  // First, create the events table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      total_tickets INTEGER NOT NULL,
      tickets_available INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (createErr) => {
    if (createErr) {
      console.error('Failed to create events table:', createErr.message);
      return;
    }
    console.log('Events table ready');
    
    // Now check if we need to migrate or add sample data
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
      
      // Add sample events if table is empty
      db.get('SELECT COUNT(*) as count FROM events', (countErr, row) => {
        if (row && row.count === 0) {
          console.log('Inserting sample events...');
          const sampleEvents = [
            { name: 'Clemson vs FSU Football', date: '2025-11-01', total_tickets: 50 },
            { name: 'Campus Concert Series', date: '2025-11-15', total_tickets: 100 },
            { name: 'Homecoming Tailgate', date: '2025-11-08', total_tickets: 75 },
            { name: 'Student Technology Expo', date: '2025-12-05', total_tickets: 200 }
          ];
          
          sampleEvents.forEach(event => {
            db.run(
              'INSERT INTO events (name, date, total_tickets, tickets_available) VALUES (?, ?, ?, ?)',
              [event.name, event.date, event.total_tickets, event.total_tickets],
              (insertErr) => {
                if (insertErr) {
                  console.error('Failed to insert sample event:', insertErr.message);
                } else {
                  console.log(`Added event: ${event.name}`);
                }
              }
            );
          });
        }
      });
    });
  });
});

// ------------------------------------------------
// Configure PRAGMA settings for concurrency handling
// ------------------------------------------------
db.serialize(() => {
  // Use WAL journal mode for better concurrency
  db.run("PRAGMA journal_mode = WAL");
  // Set a busy timeout so the DB will wait a bit when locked
  db.run("PRAGMA busy_timeout = 5000");
});


/*
 * Retrieves all events from the database.
 *
 * @function getAllEvents
 * @description Fetch all events from the "events" table and normalize ticket data.
 * @param {Function} callback - Function to execute once the query finishes.
 *   Receives parameters (err, rows), where:
 *   - err {Error|null}: Error object if a query failure occurs
 *   - rows {Array<Object>}: Array of event objects
 * @returns {void}
 */
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

/*
 * Processes a ticket purchase for a given event.
 *
 * @function purchaseTickets
 * @description Safely decrements available tickets using an atomic SQL update.
 * Prevents overselling by ensuring updates occur only when enough tickets remain.
 * Uses SQLite's implicit transaction protection for atomicity.
 *
 * @param {number} eventId - The ID of the event to purchase tickets for
 * @param {number} quantity - The number of tickets to purchase
 * @param {Function} callback - Function to execute when the transaction completes.
 *   Receives parameters (err, updatedEvent), where:
 *   - err {Error|null}: Error if not enough tickets or DB failure
 *   - updatedEvent {Object|null}: The updated event data after purchase
 * @returns {void}
 *
 * @example
 * purchaseTickets(2, 3, (err, updatedEvent) => {
 *   if (err) console.error(err.message);
 *   else console.log('Purchase successful:', updatedEvent);
 * });
 */

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