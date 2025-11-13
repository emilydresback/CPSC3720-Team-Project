// backend/user-authentication/controllers/authController.js

/**
 * Auth controller.
 * Contains business logic for registering, logging in, and returning the current user.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRATION_SECONDS = 30 * 60; // 30 minutes

/**
 * Generates a signed JWT for a user.
 *
 * @param {number} userId - ID of the authenticated user.
 * @param {string} email - Email of the authenticated user.
 * @returns {string} Signed JWT string.
 */
function generateToken(userId, email) {
  const payload = { sub: userId, email };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION_SECONDS,
  });
}

/**
 * Handles user registration request.
 * Expects { email, password } in req.body.
 *
 * Response:
 * - 201 with created user (no password) and token on success.
 * - 400/409/500 with error message otherwise.
 */
async function register(req, res) {
  // Basic input validation for required fields.
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required.",
    });
  }

  try {
    // Check if the email is already registered.
    userModel.getUserByEmail(email, async (findErr, existingUser) => {
      if (findErr) {
        console.error("Error querying user by email:", findErr);
        return res.status(500).json({ error: "Internal server error." });
      }

      if (existingUser) {
        return res.status(409).json({
          error: "A user with that email already exists.",
        });
      }

      // Hash password before storing it.
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      userModel.createUser(email, passwordHash, (createErr, createdUser) => {
        if (createErr) {
          console.error("Error creating user:", createErr);
          return res.status(500).json({ error: "Internal server error." });
        }

        const token = generateToken(createdUser.id, createdUser.email);

        // Set HTTP-only cookie for security.
        res.cookie("auth_token", token, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: TOKEN_EXPIRATION_SECONDS * 1000,
        });

        return res.status(201).json({
          message: "User registered successfully.",
          user: createdUser,
          token, // also return token for optional in-memory state
        });
      });
    });
  } catch (err) {
    console.error("Unexpected error in register:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Handles user login request.
 * Expects { email, password } in req.body.
 *
 * Response:
 * - 200 with user info and token on success.
 * - 400/401/500 on error.
 */
async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required.",
    });
  }

  try {
    userModel.getUserByEmail(email, async (err, userRow) => {
      if (err) {
        console.error("Error fetching user in login:", err);
        return res.status(500).json({ error: "Internal server error." });
      }

      if (!userRow) {
        return res.status(401).json({
          error: "Invalid email or password.",
        });
      }

      const passwordMatches = await bcrypt.compare(
        password,
        userRow.password_hash
      );

      if (!passwordMatches) {
        return res.status(401).json({
          error: "Invalid email or password.",
        });
      }

      const token = generateToken(userRow.id, userRow.email);

      res.cookie("auth_token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: TOKEN_EXPIRATION_SECONDS * 1000,
      });

      return res.status(200).json({
        message: "Login successful.",
        user: { id: userRow.id, email: userRow.email },
        token,
      });
    });
  } catch (err) {
    console.error("Unexpected error in login:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * Handles logout.
 * Clears the auth_token cookie.
 */
function logout(req, res) {
  res.clearCookie("auth_token");
  return res.status(200).json({
    message: "Logged out successfully.",
  });
}

/**
 * Returns information about the currently authenticated user.
 * Assumes authentication middleware has attached req.user.
 */
function getCurrentUser(req, res) {
  if (!req.user) {
    return res.status(401).json({
      error: "Not authenticated.",
    });
  }

  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  });
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
};
