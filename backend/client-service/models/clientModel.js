// clientModel.js
// This file handles all database operations for the client microservice

const sqlite3 = require('sqlite3').verbose(); // SQLite library
const path = require('path');

// Resolve the path to the shared SQLite database
// __dirname = folder of this file (client-service/models)
const dbPath = path.join(__dirname, '../../shared-db/database.sqlite');

// Connect to the SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to SQLite DB (client-service)');
  }
});

/**
 * Get all events from the database
 * Returns an array of events
 */
function getAllEvents(callback) {
  const query = 'SELECT * FROM events'; // table should already exist
  db.all(query, [], (err, rows) => {
    if (err) {
      return callback(err);
    }
    callback(null, rows);
  });
}

/**
 * Purchase tickets for an event
 * Ensures no overselling using a transaction
 */
function purchaseTickets(eventId, quantity, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Get the event first
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) {
        db.run('ROLLBACK');
        return callback(err);
      }
      if (!event) {
        db.run('ROLLBACK');
        return callback(new Error('Event not found'));
      }
      if (event.tickets_available < quantity) {
        db.run('ROLLBACK');
        return callback(new Error('Not enough tickets available'));
      }

      // Update ticket count
      const newCount = event.tickets_available - quantity;
      db.run(
        'UPDATE events SET tickets_available = ? WHERE id = ?',
        [newCount, eventId],
        function (updateErr) {
          if (updateErr) {
            db.run('ROLLBACK');
            return callback(updateErr);
          }

          db.run('COMMIT'); // commit transaction
          callback(null, { ...event, tickets_available: newCount });
        }
      );
    });
  });
}

module.exports = {
  getAllEvents,
  purchaseTickets,
};
