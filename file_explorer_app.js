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

// File processing utilities
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const textFiles = ['.txt', '.md', '.js', '.html', '.css', '.json', '.xml', '.csv', '.log'];
  const binaryFiles = ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt'];
  
  if (textFiles.includes(ext)) return 'text';
  if (binaryFiles.includes(ext)) return 'binary';
  return 'text'; // Default to text
}

// Read file content based on file type
async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stats = await fs.stat(filePath);
  
  const fileInfo = {
    size: stats.size,
    modified: stats.mtime,
    type: ext.slice(1), // Remove the dot
    isText: false,
    isBinary: false,
    content: '',
    error: null
  };

  try {
    switch (ext) {
      case '.pdf':
        fileInfo.isBinary = true;
        fileInfo.content = 'PDF files require a PDF viewer. The file is available for download but cannot be displayed as text in this interface.';
        fileInfo.downloadable = true;
        break;
        
      case '.xlsx':
      case '.xls':
        fileInfo.isBinary = true;
        fileInfo.content = await processExcelFile(filePath);
        break;
        
      case '.docx':
        fileInfo.isBinary = true;
        fileInfo.content = await processDocxFile(filePath);
        break;
        
      case '.doc':
        fileInfo.isBinary = true;
        fileInfo.content = 'Legacy DOC files require Microsoft Word or a compatible application. Please convert to DOCX format for text extraction.';
        break;
        
      case '.pptx':
      case '.ppt':
        fileInfo.isBinary = true;
        fileInfo.content = await processPptFile(filePath);
        break;
        
      default:
        // Handle as text file
        fileInfo.isText = true;
        fileInfo.content = await fs.readFile(filePath, 'utf8');
        break;
    }
  } catch (error) {
    fileInfo.error = `Error reading file: ${error.message}`;
    fileInfo.content = 'Unable to read file content. The file may be corrupted or in an unsupported format.';
  }

  return fileInfo;
}

// Process Excel files (basic structure display)
async function processExcelFile(filePath) {
  try {
    // For now, return a placeholder. In a real implementation, you'd use a library like 'xlsx'
    const buffer = await fs.readFile(filePath);
    return `Excel File Detected
===================

File: ${path.basename(filePath)}
Size: ${buffer.length} bytes

This is an Excel file (.xlsx/.xls). To properly view the content, you would need:

1. Microsoft Excel
2. LibreOffice Calc  
3. Google Sheets
4. Online Excel viewer

The file contains spreadsheet data with tables, formulas, and formatting that cannot be displayed as plain text.

Note: Full Excel parsing requires additional libraries like 'xlsx' or 'exceljs' to extract worksheet data, formulas, and formatting.`;
  } catch (error) {
    return `Error reading Excel file: ${error.message}`;
  }
}

// Process DOCX files (basic text extraction)
async function processDocxFile(filePath) {
  try {
    // For now, return a placeholder. In a real implementation, you'd use a library like 'mammoth'
    const buffer = await fs.readFile(filePath);
    return `Word Document Detected
======================

File: ${path.basename(filePath)}
Size: ${buffer.length} bytes

This is a Microsoft Word document (.docx). To properly view the content, you would need:

1. Microsoft Word
2. LibreOffice Writer
3. Google Docs
4. Online Word viewer

The file contains formatted text, images, tables, and other rich content that cannot be fully displayed as plain text.

Note: Full DOCX text extraction requires libraries like 'mammoth' or 'docx-parser' to extract the document content while preserving formatting.`;
  } catch (error) {
    return `Error reading Word document: ${error.message}`;
  }
}

// Process PowerPoint files
async function processPptFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return `PowerPoint Presentation Detected
===============================

File: ${path.basename(filePath)}
Size: ${buffer.length} bytes
Format: ${ext === '.pptx' ? 'PowerPoint 2007+ (PPTX)' : 'PowerPoint Legacy (PPT)'}

This is a Microsoft PowerPoint presentation. To properly view the content, you would need:

1. Microsoft PowerPoint
2. LibreOffice Impress
3. Google Slides
4. Online PowerPoint viewer

The file contains slides with text, images, animations, and other multimedia content that cannot be displayed as plain text.

Note: PowerPoint file parsing requires specialized libraries to extract slide content, speaker notes, and embedded media.`;
  } catch (error) {
    return `Error reading PowerPoint file: ${error.message}`;
  }
}

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
    
    // Check if file exists
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileInfo = await readFileContent(fullPath);
    res.json(fileInfo);
  } catch (error) {
    res.status(500).json({ error: 'Unable to read file: ' + error.message });
  }
});

// API endpoint to download files
app.get('/api/download/:filePath(*)', async (req, res) => {
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
    
    // Check if file exists
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileName = path.basename(fullPath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(fullPath);
  } catch (error) {
    res.status(500).json({ error: 'Unable to download file: ' + error.message });
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