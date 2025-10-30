// File: backend/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes/routes');
const { openDb } = require('./models/model'); // <--- IMPORT openDb

app.use(cors());
app.use('/api', routes);

const PORT = 6001;

// Start the server and initialize the database connection
// CRITICAL FIX: Run the openDb function before starting the server listener
openDb().then(() => {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}).catch(err => {
    console.error("Failed to start server or open database:", err);
});