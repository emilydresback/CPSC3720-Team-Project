const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to shared DB
const dbPath = path.join(__dirname, '../shared-db/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to DB:', err.message);
  } else {
    console.log('Connected to SQLite DB');
  }
});

// Sample events to insert
const events = [
  { name: 'Game Night', date: '2025-10-20', total_tickets: 50 },
  { name: 'Concert A', date: '2025-11-01', total_tickets: 100 },
  { name: 'Festival B', date: '2025-12-05', total_tickets: 200 },
];

db.serialize(() => {
  // Ensure table exists
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_tickets INTEGER NOT NULL,
    tickets_available INTEGER NOT NULL
  )`);

  // Insert events
  const stmt = db.prepare(`INSERT INTO events (name, date, total_tickets, tickets_available) VALUES (?, ?, ?, ?)`);

  events.forEach((e) => {
    stmt.run(e.name, e.date, e.total_tickets, e.total_tickets);
  });

  stmt.finalize();

  console.log('Sample events inserted successfully!');
});

db.close();
