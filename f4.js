// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = 3000;

// Dynamic root folder path - can be set via environment variable, command line argument, or API
let ROOT_FOLDER = process.env.ROOT_FOLDER || process.argv[2] || null;

console.log(`Initial root folder: ${ROOT_FOLDER || 'Not set - will be configured via web interface'}`);

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Set root folder dynamically
app.post('/api/set-root', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    // Validate that the path exists and is a directory
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    ROOT_FOLDER = path.resolve(folderPath);
    console.log(`Root folder set to: ${ROOT_FOLDER}`);
    
    res.json({ 
      success: true, 
      rootPath: ROOT_FOLDER,
      folderName: path.basename(ROOT_FOLDER)
    });
  } catch (error) {
    res.status(400).json({ error: `Invalid folder path: ${error.message}` });
  }
});

// Get current root folder info
app.get('/api/root-info', (req, res) => {
  if (!ROOT_FOLDER) {
    return res.json({ 
      rootPath: null,
      folderName: null,
      configured: false
    });
  }
  
  const folderName = path.basename(ROOT_FOLDER);
  res.json({ 
    rootPath: ROOT_FOLDER,
    folderName: folderName,
    configured: true
  });
});

// API endpoint to get folder structure
app.get('/api/folders/:folderPath(*)', async (req, res) => {
  try {
    if (!ROOT_FOLDER) {
      return res.status(400).json({ error: 'Root folder not configured' });
    }

    const folderPath = req.params.folderPath || '';
    const fullPath = path.join(ROOT_FOLDER, folderPath);
    
    // Security check - ensure path is within ROOT_FOLDER
    const normalizedPath = path.resolve(fullPath);
    const normalizedRoot = path.resolve(ROOT_FOLDER);
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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
    res.status(500).json({ error: 'Unable to read directory: ' + error.message });
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
    if (!ROOT_FOLDER) {
      return res.status(400).json({ error: 'Root folder not configured' });
    }

    const filePath = req.params.filePath;
    const fullPath = path.join(ROOT_FOLDER, filePath);
    
    // Security check - ensure path is within ROOT_FOLDER
    const normalizedPath = path.resolve(fullPath);
    const normalizedRoot = path.resolve(ROOT_FOLDER);
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const content = await fs.readFile(fullPath, 'utf8');
    const fileInfo = await fs.stat(fullPath);
    
    res.json({
      content: content,
      size: fileInfo.size,
      modified: fileInfo.mtime
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to read file: ' + error.message });
  }
});

// Initial folder structure for home page (folders only)
app.get('/api/home-structure', async (req, res) => {
  try {
    if (!ROOT_FOLDER) {
      return res.status(400).json({ error: 'Root folder not configured' });
    }

    const structure = await getFolderStructure(ROOT_FOLDER);
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: 'Unable to read root directory: ' + error.message });
  }
});

// Get root folder info
app.get('/api/root-info', (req, res) => {
  const folderName = path.basename(ROOT_FOLDER);
  res.json({ 
    rootPath: ROOT_FOLDER,
    folderName: folderName 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Root folder: ${ROOT_FOLDER}`);
});

// Create sample directory structure if it doesn't exist (only if using default path)
async function createSampleStructure() {
  // Only create sample structure if using the default 'sun' folder
  if (ROOT_FOLDER.endsWith('sun')) {
    const days = ['mon', 'tue', 'wed', 'thurs', 'fri', 'satur'];
    
    try {
      await fs.mkdir(ROOT_FOLDER, { recursive: true });
      
      for (const day of days) {
        const dayDir = path.join(ROOT_FOLDER, day);
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
  } else {
    console.log('Using existing directory structure at:', ROOT_FOLDER);
  }
}

// Create sample structure on startup (only for default path)
createSampleStructure();