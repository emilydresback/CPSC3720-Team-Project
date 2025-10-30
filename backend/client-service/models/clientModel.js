// backend/client-service/models/clientModel.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../../shared-db/database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Failed to connect to SQLite:", err.message);
  else console.log("Connected to SQLite DB (client-service)");
});

// Pragmas for better concurrency
db.serialize(() => {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
});

// Ensure table exists (safety if init.sql wasn’t run)
db.run(
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_tickets INTEGER NOT NULL CHECK(total_tickets >= 0),
    tickets_available INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
);

function getAllEvents(callback) {
  db.all("SELECT * FROM events ORDER BY date ASC, id ASC", [], (err, rows) => {
    if (err) return callback(err);
    const normalized = rows.map((r) => ({
      ...r,
      tickets_available:
        r.tickets_available ?? r.total_tickets ?? 0,
    }));
    callback(null, normalized);
  });
}

// Atomic decrement that prevents oversell
function purchaseTickets(eventId, quantity, callback) {
  const sql =
    "UPDATE events SET tickets_available = tickets_available - ? WHERE id = ? AND tickets_available >= ?";
  db.run(sql, [quantity, eventId, quantity], function (err) {
    if (err) return callback(err);
    if (this.changes === 0) {
      // no update ⇒ either not found or insufficient tickets
      return db.get(
        "SELECT id FROM events WHERE id = ?",
        [eventId],
        (e, r) => {
          if (e) return callback(e);
          if (!r) return callback(new Error("Event not found"));
          return callback(new Error("Not enough tickets available"));
        }
      );
    }
    // fetch updated row
    db.get("SELECT * FROM events WHERE id = ?", [eventId], (e, row) => {
      if (e) return callback(e);
      callback(null, row);
    });
  });
}

module.exports = { getAllEvents, purchaseTickets };
