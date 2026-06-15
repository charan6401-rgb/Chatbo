const path = require('path');

// Serve static files BEFORE your routes
app.use(express.static(path.join(__dirname, 'public')));
