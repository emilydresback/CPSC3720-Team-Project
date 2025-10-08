/* adminRoutes.js
Defines all API routes for the Admin Microservice
Connects incoming HTTP requests to the corresponding controller functions */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// POST /api/events
router.post('/events', adminController.createEvent);

module.exports = router;
