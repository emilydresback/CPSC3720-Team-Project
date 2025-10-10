// server.js
// Starts the client-service microservice

const express = require('express');
const cors = require('cors');
const clientRoutes = require('./routes/clientRoutes');

const app = express();

// Middleware
app.use(cors()); // allow cross-origin requests (frontend <-> backend)
app.use(express.json()); // parse JSON request bodies

// Routes
app.use('/api', clientRoutes);

// Start server
const PORT = 6001;
app.listen(PORT, () => {
  console.log(`Client service running on http://localhost:${PORT}`);
});
