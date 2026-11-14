const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', apiRoutes);

// Fallback to index.html for SPA navigation
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server and initialize database
async function startServer() {
    console.log('[Server] Initializing College Placement Management System...');
    await db.initDB();
    
    app.listen(PORT, () => {
        console.log(`========================================================================`);
        console.log(`🎓 College Placement Management System (CPMS) Web Server Running!`);
        console.log(`🌐 Local URL: http://localhost:${PORT}`);
        console.log(`🗄️  Database Status: ${db.getStatus().mode}`);
        console.log(`========================================================================`);
    });
}

startServer();

module.exports = app;
