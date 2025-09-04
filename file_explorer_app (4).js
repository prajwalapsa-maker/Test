// server.js - Simple File Explorer
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = 3000;

// Dynamic root folder path
let ROOT_FOLDER = process.env.ROOT_FOLDER || process.argv[2] || null;

console.log(`Root folder: ${ROOT_FOLDER || 'Not configured'}`);

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Set root folder
app.post('/api/set-root', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path required' });
    }
    
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Invalid directory' });
    }

    ROOT_FOLDER = path.resolve(folderPath);
    res.json({ 
      success: true, 
      rootPath: ROOT_FOLDER,
      folderName: path.basename(ROOT_FOLDER)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get root folder info
app.get('/api/root-info', (req, res) => {
  if (!ROOT_FOLDER) {
    return res.json({ configured: false });
  }
  res.json({ 
    configured: true,
    rootPath: ROOT_FOLDER,
    folderName: path.basename(ROOT_FOLDER)
  });
});

// Get folder structure (recursive)
async function getFolderStructure(dirPath, relativePath = '') {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const result = { folders: [], files: [] };
    
    for (const item of items) {
      const itemPath = path.join(relativePath, item.name).replace(/\\/g, '/');
      
      if (item.isDirectory()) {
        const subStructure = await getFolderStructure(
          path.join(dirPath, item.name), 
          itemPath
        );
        result.folders.push({
          name: item.name,
          path: itemPath,
          folders: subStructure.folders,
          files: subStructure.files
        });
      } else {
        // Only include supported file types
        const ext = path.extname(item.name).toLowerCase();
        const supportedTypes = ['.xls', '.xlsx', '.doc', '.docx', '.csv', '.txt', '.pdf', '.jpg', '.png'];
        
        if (supportedTypes.includes(ext)) {
          result.files.push({
            name: item.name,
            path: itemPath,
            type: ext.slice(1)
          });
        }
      }
    }
    
    return result;
  } catch (error) {
    return { folders: [], files: [] };
  }
}

// Get complete folder structure
app.get('/api/structure', async (req, res) => {
  try {
    if (!ROOT_FOLDER) {
      return res.status(400).json({ error: 'Root folder not configured' });
    }
    
    const structure = await getFolderStructure(ROOT_FOLDER);
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get file content
app.get('/api/file/:filePath(*)', async (req, res) => {
  try {
    if (!ROOT_FOLDER) {
      return res.status(400).json({ error: 'Root folder not configured' });
    }

    const filePath = req.params.filePath;
    const fullPath = path.join(ROOT_FOLDER, filePath);
    
    // Security check
    const normalizedPath = path.resolve(fullPath);
    const normalizedRoot = path.resolve(ROOT_FOLDER);
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const stats = await fs.stat(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    
    const fileInfo = {
      name: path.basename(fullPath),
      size: stats.size,
      modified: stats.mtime,
      type: ext.slice(1),
      content: '',
      isText: false,
      isImage: false,
      downloadable: true
    };

    // Handle different file types
    if (['.txt', '.csv'].includes(ext)) {
      fileInfo.content = await fs.readFile(fullPath, 'utf8');
      fileInfo.isText = true;
    } else if (['.jpg', '.png'].includes(ext)) {
      fileInfo.isImage = true;
      fileInfo.content = `data:image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)};base64,${(await fs.readFile(fullPath)).toString('base64')}`;
    } else {
      // For xlsx, xls, doc, docx, pdf - show file info and download option
      fileInfo.content = `File: ${fileInfo.name}\nType: ${getFileTypeName(ext)}\nSize: ${formatFileSize(fileInfo.size)}\nModified: ${fileInfo.modified.toLocaleString()}\n\nThis file type requires specialized software to view properly.\nUse the download button to save the file locally.`;
    }
    
    res.json(fileInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download file
app.get('/api/download/:filePath(*)', (req, res) => {
  try {
    if (!ROOT_FOLDER) {
      return res.status(400).json({ error: 'Root folder not configured' });
    }

    const filePath = req.params.filePath;
    const fullPath = path.join(ROOT_FOLDER, filePath);
    
    // Security check
    const normalizedPath = path.resolve(fullPath);
    const normalizedRoot = path.resolve(ROOT_FOLDER);
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.download(fullPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function getFileTypeName(ext) {
  const types = {
    '.txt': 'Text File',
    '.csv': 'CSV Spreadsheet',
    '.xlsx': 'Excel Spreadsheet',
    '.xls': 'Excel Spreadsheet (Legacy)',
    '.docx': 'Word Document',
    '.doc': 'Word Document (Legacy)',
    '.pdf': 'PDF Document',
    '.jpg': 'JPEG Image',
    '.png': 'PNG Image'
  };
  return types[ext] || 'Unknown File';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

app.listen(PORT, () => {
  console.log(`🚀 Enhanced File Explorer running on http://localhost:${PORT}`);
  console.log('📁 Universal file support with enhanced content viewing:');
  console.log('  📊 Excel: ' + (XLSX ? '✅ Content extraction enabled' : '⚠️ Install: npm install xlsx'));
  console.log('  📕 PDF: ' + (pdfParse ? '✅ Text extraction enabled' : '⚠️ Install: npm install pdf-parse'));
  console.log('  📝 Text: TXT, CSV, JSON, XML, HTML, CSS, JS, MD, LOG, INI, CFG');
  console.log('  🖼️ Images: JPG, PNG, GIF, BMP, WebP, SVG, ICO (with preview)');
  console.log('  📄 All other file types: Download + file info');
  console.log('\n💡 For full Excel and PDF content viewing:');
  console.log('   npm install xlsx pdf-parse');
});