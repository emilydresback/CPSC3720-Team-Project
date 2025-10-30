// File: backend/controllers/controller.js (Update and replace the existing file content)

const { getEvents, updateTicketCount } = require('../models/model');

// 1. GET Events Controller
const listEvents = async (req, res) => {
    try {
        const events = await getEvents();
        res.json(events);
    } catch (error) {
        console.error("Error retrieving events:", error);
        res.status(500).json({ error: "Failed to retrieve events from the database." });
    }
};

// 2. POST Purchase Controller
const purchaseTicket = async (req, res) => {
    const eventId = parseInt(req.params.id);
    
    try {
        const result = await updateTicketCount(eventId);

        if (result.success) {
            res.status(200).json({ message: result.message });
        } else {
            res.status(400).send(result.message);
        }
    } catch (error) {
        console.error("Error purchasing ticket:", error);
        res.status(500).send("Internal server error during purchase.");
    }
};

module.exports = { listEvents, purchaseTicket };