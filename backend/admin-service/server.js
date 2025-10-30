// backend/admin-service/server.js
const express = require("express");
const cors = require("cors");
const routes = require("./routes/adminRoutes");
const setup = require("./setup"); // creates tables if needed

const app = express();
app.use(cors());
app.use(express.json());

// Ensure DB is ready at boot
setup();

// Mount /api/admin
app.use("/api/admin", routes);

const PORT = 5001;
app.listen(PORT, () =>
  console.log(`Admin Service running at http://localhost:${PORT}`)
);
