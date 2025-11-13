// backend/user-authentication/middleware/authMiddleware.js

/**
 * JWT authentication middleware for protecting sensitive routes.
 */

const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Express middleware that verifies the JWT from cookie or Authorization header.
 *
 * On success:
 *   - Attaches { id, email } to req.user and calls next().
 * On failure:
 *   - Returns 401 with an appropriate error message.
 */
function authenticateToken(req, res, next) {
  // Try to read token from HTTP-only cookie first.
  let token = req.cookies?.auth_token;

  // Fallback: read from Authorization header: "Bearer <token>"
  if (!token && req.headers.authorization) {
    const [scheme, value] = req.headers.authorization.split(" ");
    if (scheme === "Bearer") {
      token = value;
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication token missing." });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      const isExpired = err.name === "TokenExpiredError";
      return res.status(401).json({
        error: isExpired ? "Token expired." : "Invalid token.",
      });
    }

    const userId = payload.sub;

    userModel.getUserById(userId, (userErr, userRow) => {
      if (userErr) {
        console.error("Error looking up user from token:", userErr);
        return res.status(500).json({ error: "Internal server error." });
      }

      if (!userRow) {
        return res.status(401).json({ error: "User no longer exists." });
      }

      req.user = {
        id: userRow.id,
        email: userRow.email,
      };

      next();
    });
  });
}

module.exports = {
  authenticateToken,
};
