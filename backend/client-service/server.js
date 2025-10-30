// server.js
// ================================================
// Entry point for the Client-Service microservice.
//
// Responsibilities:
//   - Initialize the Express application
//   - Configure global middleware (CORS, JSON parsing)
//   - Mount all API routes under the /api prefix
//   - Start the server on the specified port
//
// This service handles client-facing requests such as
// fetching available events and purchasing tickets.
//
// Example:
//   GET  http://localhost:6001/api/events
//   POST http://localhost:6001/api/events/:id/purchase
// ================================================

const express = require('express');
const cors = require('cors');
const clientRoutes = require('./routes/clientRoutes');

const app = express();

// ------------------------------------------------
// MIDDLEWARE CONFIGURATION
// ------------------------------------------------

// Enable Cross-Origin Resource Sharing (CORS)
// so that frontend clients (e.g., web UI) can access the API
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// ------------------------------------------------
// ROUTE REGISTRATION
// ------------------------------------------------
// All client-related endpoints are defined in clientRoutes.js
// and mounted here under the "/api" namespace
app.use('/api', clientRoutes);

// ------------------------------------------------
// EXPORT FOR TESTING
// ------------------------------------------------
module.exports = app;

// ------------------------------------------------
// SERVER STARTUP (only when run directly)
// ------------------------------------------------
if (require.main === module) {
  const PORT = 6001;
  app.listen(PORT, () => {
    console.log(`Client service running on http://localhost:${PORT}`);
  });
}