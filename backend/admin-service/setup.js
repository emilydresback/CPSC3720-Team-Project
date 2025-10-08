/* setup.js
Ensures the shared SQLite database and tables exist by running init.sql
Called automatically when the admin server starts */

// Initializes the shared SQLite database using init.sql
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../shared-db/database.sqlite');
const initScript = fs.readFileSync(path.join(__dirname, '../shared-db/init.sql'), 'utf8');

const db = new sqlite3.Database(dbPath);
db.exec(initScript, (err) => {
  if (err) console.error('DB init error:', err);
  else console.log('Database initialized successfully.');
});
db.close();
