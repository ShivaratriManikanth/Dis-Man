const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all files inside /public as static assets
app.use(express.static(path.join(__dirname, 'public')));

// Root → Login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Disaster Response System running at http://localhost:${PORT}`);
});
