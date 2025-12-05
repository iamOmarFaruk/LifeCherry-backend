const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Home route
app.get('/', (req, res) => {
  res.json({ message: 'Hello LifeCherry' });
});

app.listen(PORT, () => {
  console.log(`LifeCherry server running on port ${PORT}`);
});
