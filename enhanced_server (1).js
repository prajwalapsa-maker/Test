// enhanced-server.js - Advanced version with actual file processing
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = 3000;

// Try to import optional dependencies
let pdfParse, XLSX, mammoth;
try {
  pdfParse = require('pdf-parse');
  console.log('✅ PDF processing enabled');
} catch (e) {
  console.log('⚠️  PDF processing disabled - install pdf-parse: npm install pdf-parse');
}

try {
  XLSX = require('xlsx');
  console.log('✅ Excel processing enabled');
} catch (e) {
  console.log('⚠️  Excel processing disabled - install xlsx: npm install xlsx');
}

try {
  mammoth = require('mammoth');
  console.log('✅ Word document processing enabled');
} catch (e) {
  console.log('⚠️  Word document processing disabled - install mammoth: npm install mammoth');
}

// Dynamic root folder path
let ROOT_FOLDER = process.env.ROOT_FOLDER || process.argv[2] || null;

console.log(`Initial root folder: ${ROOT_FOLDER || 'Not set - will be configured via web interface'}`);

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Enhanced file processing utilities
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const textFiles = ['.txt', '.md', '.js', '.html', '.css', '.json', '.xml', '.csv', '.log'];
  const binaryFiles = ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt'];
  
  if (textFiles.includes(ext)) return 'text';
  if (binaryFiles.includes(ext)) return 'binary';
  return 'text';
}

// Enhanced file content reader with actual processing
async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stats = await fs.stat(filePath);
  
  const fileInfo = {
    size: stats.size,
    modified: stats.mtime,
    type: ext.slice(1),
    isText: false,
    isBinary: false,
    content: '',
    error: null,
    downloadable: false
  };

  try {
    switch (ext) {
      case '.pdf':
        fileInfo.isBinary = true;
        fileInfo.downloadable = true;
        if (pdfParse) {
          fileInfo.content = await processPdfFile(filePath);
        } else {
          fileInfo.content = 'PDF Processing Unavailable\n\nTo enable PDF text extraction, install the pdf-parse library:\nnpm install pdf-parse\n\nThe file is available for download.';
        }
        break;
        
      case '.xlsx':
      case '.xls':
        fileInfo.isBinary = true;
        fileInfo.downloadable = true;
        if (XLSX) {
          fileInfo.content = await processExcelFile(filePath);
        } else {
          fileInfo.content = 'Excel Processing Unavailable\n\nTo enable Excel file reading, install the xlsx library:\nnpm install xlsx\n\nThe file is available for download.';
        }
        break;
        
      case '.docx':
        fileInfo.isBinary = true;
        fileInfo.downloadable = true;
        if (mammoth) {
          fileInfo.content = await processDocxFile(filePath);
        } else {
          fileInfo.content = 'Word Document Processing Unavailable\n\nTo enable DOCX text extraction, install the mammoth library:\nnpm install mammoth\n\nThe file is available for download.';
        }
        break;
        
      case '.doc':
        fileInfo.isBinary = true;
        fileInfo.downloadable = true;
        fileInfo.content = 'Legacy DOC Format\n\nLegacy .DOC files are not supported for text extraction.\nPlease convert to .DOCX format or use Microsoft Word.\n\nThe file is available for download.';
        break;
        
      case '.pptx':
      case '.ppt':
        fileInfo.isBinary = true;
        fileInfo.downloadable = true;
        fileInfo.content = await processPptFile(filePath);
        break;
        
      default:
        // Handle as text file
        fileInfo.isText = true;
        const content = await fs.readFile(filePath, 'utf8');
        fileInfo.content = content;
        break;
    }
  } catch (error) {
    fileInfo.error = `Error reading file: ${error.message}`;
    fileInfo.content = `Unable to read file content: ${error.message}\n\nThe file may be:\n- Corrupted\n- Password protected\n- In an unsupported format\n- Too large to process`;
  }

  return fileInfo;
}

// Process PDF files with actual text extraction
async function processPdfFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    
    const extractedText = data.text.trim();
    if (!extractedText) {
      return `PDF Document - Text Extraction Complete
==========================================

File: ${path.basename(filePath)}
Pages: ${data.numpages}
Size: ${buffer.length} bytes

⚠️ No text content found in this PDF.
This may be a scanned document or image-based PDF.

For scanned PDFs, you would need OCR (Optical Character Recognition) software.`;
    }
    
    return `PDF Document - Text Extraction
=================================

File: ${path.basename(filePath)}
Pages: ${data.numpages}
Size: ${buffer.length} bytes

Extracted Text Content:
-----------------------

${extractedText}`;
  } catch (error) {
    return `Error processing PDF: ${error.message}\n\nThe PDF file may be:\n- Password protected\n- Corrupted\n- Using unsupported features`;
  }
}

// Process Excel files with actual data extraction
async function processExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    let content = `Excel Spreadsheet Data
====================

File: ${path.basename(filePath)}
Worksheets: ${sheetNames.length}

`;

// Process Excel files with actual data extraction
async function processExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    let content = `Excel Spreadsheet Data
====================

File: ${path.basename(filePath)}
Worksheets: ${sheetNames.length}

`;

    // Process each worksheet
    sheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      content += `Sheet ${index + 1}: "${sheetName}"
${'-'.repeat(sheetName.length + 10)}
`;
      
      if (jsonData.length === 0) {
        content += 'Empty worksheet\n\n';
        return;
      }
      
      // Display first 20 rows to avoid overwhelming output
      const displayRows = jsonData.slice(0, 20);
      const maxCols = Math.max(...displayRows.map(row => row.length));
      
      // Create a simple table format
      displayRows.forEach((row, rowIndex) => {
        const paddedRow = Array(maxCols).fill('').map((_, colIndex) => {
          const cellValue = row[colIndex] || '';
          return String(cellValue).substring(0, 15).padEnd(15);
        });
        content += `${paddedRow.join(' | ')}\n`;
        
        // Add separator after header row
        if (rowIndex === 0 && displayRows.length > 1) {
          content += `${'-'.repeat(paddedRow.length * 18)}\n`;
        }
      });
      
      if (jsonData.length > 20) {
        content += `\n... and ${jsonData.length - 20} more rows\n`;
      }
      
      content += `\nTotal rows: ${jsonData.length}\nTotal columns: ${maxCols}\n\n`;
    });

    return content;
  } catch (error) {
    return `Error processing Excel file: ${error.message}\n\nThe Excel file may be:\n- Corrupted\n- Password protected\n- Using unsupported Excel features`;
  }
}

// Process DOCX files with actual text extraction
async function processDocxFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: buffer });
    
    const extractedText = result.value.trim();
    const warnings = result.messages;
    
    let content = `Word Document - Text Extraction
===============================

File: ${path.basename(filePath)}
Size: ${buffer.length} bytes

`;

    if (warnings.length > 0) {
      content += `Warnings during extraction:\n`;
      warnings.forEach(warning => {
        content += `- ${warning.message}\n`;
      });
      content += '\n';
    }

    if (!extractedText) {
      content += '⚠️ No text content found in this document.\nThe document may contain only images, tables, or other non-text elements.';
    } else {
      content += `Extracted Text Content:\n`;
      content += '-'.repeat(25) + '\n\n';
      content += extractedText;
    }

    return content;
  } catch (error) {
    return `Error processing Word document: ${error.message}\n\nThe document may be:\n- Corrupted\n- Password protected\n- Using unsupported Word features`;
  }
}

// Process PowerPoint files (basic info - full extraction requires specialized libraries)
async function processPptFile(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    
    return `PowerPoint Presentation
========================

File: ${path.basename(filePath)}
Format: ${ext === '.pptx' ? 'PowerPoint 2007+ (PPTX)' : 'PowerPoint Legacy (PPT)'}
Size: ${formatBytes(buffer.length)}
Last Modified: ${stats.mtime.toLocaleString()}

PowerPoint Content Extraction:
-----------------------------

⚠️ Full PowerPoint text extraction requires specialized libraries.

For complete slide content extraction, consider using:
- python-pptx (Python)
- Apache POI (Java)
- Online PowerPoint to text converters

This file is available for download to view in:
- Microsoft PowerPoint
- LibreOffice Impress  
- Google Slides
- Online PowerPoint viewers

The presentation may contain:
- Multiple slides with text content
- Images and multimedia
- Animations and transitions
- Speaker notes
- Embedded charts and tables`;
  } catch (error) {
    return `Error accessing PowerPoint file: ${error.message}`;
  }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

// API endpoint to get file content with enhanced processing
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

app.listen(PORT, () => {
  console.log(`\n🚀 Enhanced File Explorer Server running on http://localhost:${PORT}`);
  console.log(`📁 Root folder: ${ROOT_FOLDER || 'Not configured'}\n`);
  
  console.log('📋 Supported file types:');
  console.log('  📝 Text files: .txt, .md, .js, .html, .css, .json, .xml');
  console.log('  📊 Excel files: .xlsx, .xls' + (XLSX ? ' ✅' : ' ⚠️'));
  console.log('  📘 Word documents: .docx' + (mammoth ? ' ✅' : ' ⚠️'));
  console.log('  📕 PDF documents: .pdf' + (pdfParse ? ' ✅' : ' ⚠️'));
  console.log('  📊 PowerPoint: .pptx, .ppt (basic support)');
  console.log('\n💡 Install optional dependencies for full support:');
  console.log('  npm install pdf-parse xlsx mammoth\n');
});