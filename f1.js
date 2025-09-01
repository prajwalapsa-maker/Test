// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// API endpoint to get folder structure
app.get('/api/folders/:folderPath(*)', async (req, res) => {
  try {
    const folderPath = req.params.folderPath || '';
    const fullPath = path.join(__dirname, 'sun', folderPath);
    
    const items = await fs.readdir(fullPath, { withFileTypes: true });
    const structure = {
      folders: [],
      files: []
    };
    
    for (const item of items) {
      if (item.isDirectory()) {
        const subFolders = await getFolderStructure(path.join(fullPath, item.name));
        structure.folders.push({
          name: item.name,
          path: path.join(folderPath, item.name).replace(/\\/g, '/'),
          subFolders: subFolders
        });
      } else {
        structure.files.push({
          name: item.name,
          path: path.join(folderPath, item.name).replace(/\\/g, '/')
        });
      }
    }
    
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: 'Unable to read directory' });
  }
});

// Recursive function to get folder structure (folders only)
async function getFolderStructure(dirPath) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const folders = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        const subFolders = await getFolderStructure(path.join(dirPath, item.name));
        folders.push({
          name: item.name,
          subFolders: subFolders
        });
      }
    }
    
    return folders;
  } catch (error) {
    return [];
  }
}

// API endpoint to get file content
app.get('/api/file/:filePath(*)', async (req, res) => {
  try {
    const filePath = req.params.filePath;
    const fullPath = path.join(__dirname, 'sun', filePath);
    
    const content = await fs.readFile(fullPath, 'utf8');
    const fileInfo = await fs.stat(fullPath);
    
    res.json({
      content: content,
      size: fileInfo.size,
      modified: fileInfo.mtime
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to read file' });
  }
});

// Initial folder structure for home page (folders only)
app.get('/api/home-structure', async (req, res) => {
  try {
    const sunPath = path.join(__dirname, 'sun');
    const structure = await getFolderStructure(sunPath);
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: 'Unable to read sun directory' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Create sample directory structure if it doesn't exist
async function createSampleStructure() {
  const baseDir = path.join(__dirname, 'sun');
  const days = ['mon', 'tue', 'wed', 'thurs', 'fri', 'satur'];
  
  try {
    await fs.mkdir(baseDir, { recursive: true });
    
    for (const day of days) {
      const dayDir = path.join(baseDir, day);
      await fs.mkdir(dayDir, { recursive: true });
      
      // Create some sample subdirectories and files
      await fs.mkdir(path.join(dayDir, 'meetings'), { recursive: true });
      await fs.mkdir(path.join(dayDir, 'tasks'), { recursive: true });
      await fs.mkdir(path.join(dayDir, 'notes'), { recursive: true });
      
      // Create sample files
      await fs.writeFile(path.join(dayDir, 'schedule.txt'), `Schedule for ${day}\n\nMorning: Team standup\nAfternoon: Project work`);
      await fs.writeFile(path.join(dayDir, 'meetings', 'agenda.md'), `# ${day.toUpperCase()} Meeting Agenda\n\n- Review progress\n- Discuss blockers\n- Plan next steps`);
      await fs.writeFile(path.join(dayDir, 'tasks', 'todo.txt'), `${day} Tasks:\n1. Complete code review\n2. Update documentation\n3. Test new features`);
      await fs.writeFile(path.join(dayDir, 'notes', 'daily.md'), `# Daily Notes - ${day}\n\nKey points from today's work...`);
    }
    
    console.log('Sample directory structure created successfully!');
  } catch (error) {
    console.log('Directory structure might already exist or error occurred:', error.message);
  }
}

// Create sample structure on startup
createSampleStructure();