/* server.js
Main entry point for the Admin Microservice
Starts the Express server, sets up middleware, and mounts admin routes
Initializes the shared SQLite database on startup */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const adminRoutes = require('./routes/adminRoutes');
require('./setup'); // create tables on startup

const app = express();
const PORT = 5001;

app.use(cors());
app.use(bodyParser.json());

// Prefix all routes with /api/admin
app.use('/api/admin', adminRoutes);

// Global error handler (catch any unexpected errors)
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`Admin microservice running on port ${PORT}`);
});



module.exports = app;

// Keep your existing app.listen() but wrap it:
if (require.main === module) {
  app.listen(5001, () => {
    console.log('Admin service on port 5001');
  });
}