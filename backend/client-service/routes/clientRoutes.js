// clientRoutes.js
// Defines API endpoints for the client-service

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// GET all events
router.get('/events', clientController.getEvents);

// POST purchase tickets
router.post('/events/:id/purchase', clientController.purchase);

module.exports = router;
