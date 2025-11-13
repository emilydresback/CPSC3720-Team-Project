// backend/user-authentication/models/userModel.js

/**
 * User data access layer.
 * Handles all database operations for the users table.
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Path to the shared SQLite database used by other services.
const dbPath = path.join(__dirname, "../../shared-db/database.sqlite");

/** @type {sqlite3.Database} */
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite in user-authentication:", err);
  } else {
    console.log("Connected to SQLite DB (user-authentication)");
  }
});

/**
 * Inserts a new user row into the database.
 *
 * @param {string} email - Unique email address for the user.
 * @param {string} passwordHash - Bcrypt-hashed user password.
 * @param {function(Error|null, object|null)} callback - Called with created user.
 */
function createUser(email, passwordHash, callback) {
  const sql = `
    INSERT INTO users (email, password_hash)
    VALUES (?, ?)
  `;

  db.run(sql, [email, passwordHash], function onInsert(err) {
    if (err) return callback(err, null);

    callback(null, {
      id: this.lastID,
      email,
    });
  });
}

/**
 * Retrieves a single user by email.
 *
 * @param {string} email - Email address to search for.
 * @param {function(Error|null, object|null)} callback - Called with user row or null.
 */
function getUserByEmail(email, callback) {
  const sql = `
    SELECT id, email, password_hash
    FROM users
    WHERE email = ?
  `;

  db.get(sql, [email], (err, row) => {
    if (err) return callback(err, null);
    callback(null, row || null);
  });
}

/**
 * Retrieves a single user by ID.
 *
 * @param {number} id - Primary key of the user.
 * @param {function(Error|null, object|null)} callback - Called with user row or null.
 */
function getUserById(id, callback) {
  const sql = `
    SELECT id, email
    FROM users
    WHERE id = ?
  `;

  db.get(sql, [id], (err, row) => {
    if (err) return callback(err, null);
    callback(null, row || null);
  });
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
};
