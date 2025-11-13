// backend/user-authentication/server.js

/**
 * Entry point for the user-authentication microservice.
 * Sets up Express, middleware, and routes.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 7005;

/**
 * Configure global middleware for JSON parsing,
 * CORS, and cookies.
 */
app.use(express.json());
app.use(cookieParser());

// Allow frontend (React) origin to send cookies.
app.use(
  cors({
    origin: "http://localhost:7001",
    credentials: true,
  })
);

// Mount authentication routes.
app.use("/auth", authRoutes);

/**
 * Simple health-check endpoint for this service.
 */
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "user-authentication" });
});

// Global error handler fallback.
app.use((err, req, res, next) => {
  console.error("Unhandled error in auth service:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`User-authentication service listening on port ${PORT}`);
});
