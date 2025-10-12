// clientRoutes.js
// Defines API endpoints for the client-service

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

/*
 * @route GET /api/events
 * @description Retrieve a list of all available events.
 * @access Public
 *
 * @example
 * GET /api/events
 * Response: [
 *   { id: 1, name: "Concert A", tickets_available: 20, total_tickets: 100 },
 *   { id: 2, name: "Festival B", tickets_available: 50, total_tickets: 200 }
 * ]
 */
router.get('/events', clientController.getEvents);

/*
 * @route POST /api/events/:id/purchase
 * @description Purchase a given number of tickets for the specified event.
 * Expects a JSON body: { "quantity": <number> }
 * Returns the updated event details if successful.
 * @access Public
 *
 * @example
 * POST /api/events/1/purchase
 * Body: { "quantity": 2 }
 * Response:
 * {
 *   "message": "Purchase successful!",
 *   "event": { "id": 1, "name": "Concert A", "tickets_available": 18 }
 * }
 */
router.post('/events/:id/purchase', clientController.purchase);

module.exports = router;
