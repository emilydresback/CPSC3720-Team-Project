// File: backend/routes/routes.js (Update and replace the existing file content)

const express = require('express');
const router = express.Router();
// Import both controller functions
const { listEvents, purchaseTicket } = require('../controllers/controller'); 

// GET /api/events (Loads the list)
router.get('/events', listEvents);

// POST /api/events/:id/purchase (Handles the booking logic)
router.post('/events/:id/purchase', purchaseTicket); 

module.exports = router;