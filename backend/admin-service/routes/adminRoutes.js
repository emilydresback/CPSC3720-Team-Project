// backend/admin-service/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// POST /api/admin/events
router.post("/events", adminController.createEvent);

// GET /api/admin/events
router.get("/events", adminController.listEvents);

// PUT /api/admin/events/:id  (update tickets or name/date)
router.put("/events/:id", adminController.updateEvent);

module.exports = router;
