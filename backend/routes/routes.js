// File: backend/routes/routes.js (Update and replace the existing file content)

const express = require('express');
const router = express.Router();
// Import controller functions
const { listEvents, purchaseTicket, handleChat } = require('../controllers/controller'); 

// GET /api/events (Loads the list)
router.get('/events', listEvents);

// POST /api/events/:id/purchase (Handles the booking logic)
router.post('/events/:id/purchase', purchaseTicket); 

// POST /api/chat (Handles chat messages)
router.post('/chat', handleChat);

module.exports = router;