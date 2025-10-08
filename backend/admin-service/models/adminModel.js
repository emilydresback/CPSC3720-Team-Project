/* adminModel.js
Interacts directly with the shared SQLite database.
Contains functions that perform SQL queries for event data */

/*
 * Handles all DB operations for Admin microservice
 * Uses shared SQLite DB connection
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to shared DB
const dbPath = path.join(__dirname, '../../shared-db/database.sqlite');
const db = new sqlite3.Database(dbPath);

/*
 * Inserts a new event record into the events table
 * @param {Object} eventData - { name, date, total_tickets }
 * @param {Function} callback - callback(err, result)
 */
exports.createEvent = (eventData, callback) => {
  const { name, date, total_tickets } = eventData;
  const query = `INSERT INTO events (name, date, total_tickets) VALUES (?, ?, ?)`;

  db.run(query, [name, date, total_tickets], function (err) {
    if (err) return callback(err);
    callback(null, { id: this.lastID, ...eventData });
  });
};
