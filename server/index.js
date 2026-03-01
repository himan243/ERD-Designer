const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'diagrams.json');

app.use(cors());
app.use(express.json());

// Health check for Render
app.get('/health', (req, res) => res.status(200).send('OK'));
const readDiagrams = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading diagrams file:', err);
    return [];
  }
};

const saveDiagrams = (diagrams) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(diagrams, null, 2));
  } catch (err) {
    console.error('Error saving diagrams file:', err);
  }
};

// GET all diagrams
app.get('/api/diagrams', (req, res) => {
  const diagrams = readDiagrams();
  res.json(diagrams);
});

// GET a specific diagram by ID
app.get('/api/diagrams/:id', (req, res) => {
  const diagrams = readDiagrams();
  const diagram = diagrams.find(d => d.id === parseInt(req.params.id));
  if (diagram) {
    res.json(diagram);
  } else {
    res.status(404).json({ message: 'Diagram not found' });
  }
});

// POST a new diagram or update existing
app.post('/api/diagrams', (req, res) => {
  const diagrams = readDiagrams();
  const { id, name, nodes, edges } = req.body;

  if (id) {
    // Update existing
    const index = diagrams.findIndex(d => d.id === id);
    if (index !== -1) {
      diagrams[index] = { ...diagrams[index], name, nodes, edges, updatedAt: new Date().toISOString() };
      saveDiagrams(diagrams);
      return res.json(diagrams[index]);
    }
  }

  // Create new
  const newDiagram = {
    id: Date.now(),
    name: name || `Diagram ${diagrams.length + 1}`,
    nodes,
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  diagrams.push(newDiagram);
  saveDiagrams(diagrams);
  res.status(201).json(newDiagram);
});

// DELETE a diagram
app.delete('/api/diagrams/:id', (req, res) => {
  let diagrams = readDiagrams();
  const initialLength = diagrams.length;
  diagrams = diagrams.filter(d => d.id !== parseInt(req.params.id));
  
  if (diagrams.length < initialLength) {
    saveDiagrams(diagrams);
    res.json({ message: 'Diagram deleted' });
  } else {
    res.status(404).json({ message: 'Diagram not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
