// File: backend/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes/routes');
const { openDb } = require('./models/model');

// Configure CORS for production
const corsOptions = {
    origin: process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'TigerTix Backend is running' });
});

// Use Railway's PORT environment variable or default to 6001
const PORT = process.env.PORT || process.env.CLIENT_PORT || 6001;

// Start the server and initialize the database connection
openDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`TigerTix Backend Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}).catch(err => {
    console.error("Failed to start server or open database:", err);
    process.exit(1);
});