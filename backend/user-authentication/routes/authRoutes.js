// backend/user-authentication/routes/authRoutes.js

/**
 * Defines HTTP routes for registration, login, logout,
 * and retrieving the current user.
 */

const express = require("express");
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

// Protected example route
router.get("/me", authenticateToken, authController.getCurrentUser);

// Example of a protected "booking" route
router.get("/protected-booking", authenticateToken, (req, res) => {
  // This is just a placeholder to show route protection.
  return res.json({
    message: "You have accessed a protected booking route.",
    user: req.user,
  });
});

module.exports = router;
