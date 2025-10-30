const model = require("../models/clientModel");

function getEvents(req, res) {
  model.getAllEvents((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(rows);
  });
}

function purchase(req, res) {
  const id = Number(req.params.id);
  const quantity = Number(req.body?.quantity || 1);
  model.purchaseTickets(id, quantity, (err, updated) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({
      message: "Purchase successful",
      event: updated,
    });
  });
}

module.exports = { getEvents, purchase };
