// backend/admin-service/setup.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

module.exports = function setup() {
  const dbPath = path.join(__dirname, "../shared-db/database.sqlite");
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA busy_timeout = 5000");

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
  });

  db.close();
};
