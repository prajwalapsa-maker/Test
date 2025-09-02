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

    // Process each worksheet
    sheetNames.forEach((sheetName, index) => {
      const worksheet = work