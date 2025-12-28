const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Load the elemental dictionary
const dictionaryPath = path.join(__dirname, '../elemental_dictionary.json');
if (!fs.existsSync(dictionaryPath)) {
    console.log('did not load dictionary')
}

app.get('/', (req, res) => {
  res.json({ message: 'Elemental Dictionary API' });
});

app.get('/entry/:key', (req, res) => {
  //ENSURE WE ARE SENDING THE LATEST FILE CHANGES
  const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  const entry = dictionary[req.params.key];
  if (entry) {
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Entry not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
