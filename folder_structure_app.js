// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// Set view engine
app.set('view engine', 'ejs');

// Function to get folder structure
async function getFolderStructure(dirPath, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return null;
    
    try {
        const items = await fs.readdir(dirPath);
        const structure = [];
        
        for (const item of items) {
            // Skip hidden files and common system folders
            if (item.startsWith('.') || ['node_modules', '.git', 'dist', 'build'].includes(item)) {
                continue;
            }
            
            const itemPath = path.join(dirPath, item);
            const stat = await fs.stat(itemPath);
            
            if (stat.isDirectory()) {
                const children = await getFolderStructure(itemPath, maxDepth, currentDepth + 1);
                structure.push({
                    name: item,
                    type: 'folder',
                    path: itemPath,
                    children: children || []
                });
            } else {
                structure.push({
                    name: item,
                    type: 'file',
                    path: itemPath,
                    size: stat.size
                });
            }
        }
        
        return structure.sort((a, b) => {
            // Folders first, then files
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    } catch (error) {
        console.error('Error reading directory:', error);
        return null;
    }
}

// Routes
app.get('/', async (req, res) => {
    const rootPath = req.query.path || process.cwd();
    const structure = await getFolderStructure(rootPath);
    
    res.render('index', { 
        structure, 
        currentPath: rootPath,
        title: 'Folder Structure Explorer'
    });
});

app.get('/api/folder', async (req, res) => {
    const folderPath = req.query.path;
    if (!folderPath) {
        return res.status(400).json({ error: 'Path parameter required' });
    }
    
    try {
        const structure = await getFolderStructure(folderPath);
        res.json({ structure, path: folderPath });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Displaying structure for: ${process.cwd()}`);
});

// ===== views/index.ejs =====
/*
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
    <link rel="stylesheet" href="/styles.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1><i class="fas fa-folder-tree"></i> Folder Structure Explorer</h1>
            <div class="current-path">
                <i class="fas fa-map-marker-alt"></i>
                <span><%= currentPath %></span>
            </div>
        </header>
        
        <main class="main-content">
            <div class="tree-container">
                <% if (structure && structure.length > 0) { %>
                    <ul class="tree-root">
                        <% structure.forEach(function(item) { %>
                            <%- include('partials/tree-item', { item: item, level: 0 }) %>
                        <% }); %>
                    </ul>
                <% } else { %>
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <p>No accessible folders found in this directory</p>
                    </div>
                <% } %>
            </div>
        </main>
    </div>

    <script src="/script.js"></script>
</body>
</html>
*/

// ===== views/partials/tree-item.ejs =====
/*
<li class="tree-item" data-level="<%= level %>">
    <div class="item-content">
        <% if (item.type === 'folder') { %>
            <button class="folder-toggle" onclick="toggleFolder(this)">
                <i class="fas fa-chevron-right"></i>
            </button>
            <a href="/?path=<%= encodeURIComponent(item.path) %>" 
               target="_blank" 
               class="folder-link" 
               onclick="openFolderInNewTab(event, '<%= item.path %>')">
                <i class="fas fa-folder"></i>
                <span class="item-name"><%= item.name %></span>
            </a>
        <% } else { %>
            <span class="file-icon-placeholder"></span>
            <i class="fas fa-file"></i>
            <span class="item-name"><%= item.name %></span>
            <span class="file-size"><%= (item.size / 1024).toFixed(1) %> KB</span>
        <% } %>
    </div>
    
    <% if (item.type === 'folder' && item.children && item.children.length > 0) { %>
        <ul class="tree-children">
            <% item.children.forEach(function(child) { %>
                <%- include('tree-item', { item: child, level: level + 1 }) %>
            <% }); %>
        </ul>
    <% } %>
</li>
*/

// ===== public/styles.css =====
/*
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 30px;
    margin-bottom: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.header h1 {
    font-size: 2.5rem;
    color: #4a5568;
    margin-bottom: 15px;
    font-weight: 700;
}

.header h1 i {
    color: #667eea;
    margin-right: 15px;
}

.current-path {
    display: flex;
    align-items: center;
    font-size: 1.1rem;
    color: #718096;
    background: #f7fafc;
    padding: 12px 18px;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.current-path i {
    margin-right: 10px;
    color: #667eea;
}

.main-content {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.tree-container {
    max-height: 70vh;
    overflow-y: auto;
    padding-right: 10px;
}

.tree-container::-webkit-scrollbar {
    width: 8px;
}

.tree-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.tree-container::-webkit-scrollbar-thumb {
    background: #667eea;
    border-radius: 4px;
}

.tree-root, .tree-children {
    list-style: none;
    margin: 0;
    padding: 0;
}

.tree-children {
    margin-left: 25px;
    border-left: 2px solid #e2e8f0;
    padding-left: 15px;
    margin-top: 5px;
}

.tree-item {
    margin: 3px 0;
    position: relative;
}

.item-content {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
    position: relative;
}

.item-content:hover {
    background: linear-gradient(90deg, #f7fafc, #edf2f7);
    transform: translateX(5px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.folder-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    margin-right: 8px;
    border-radius: 4px;
    transition: all 0.2s ease;
    color: #667eea;
}

.folder-toggle:hover {
    background: #667eea;
    color: white;
    transform: scale(1.1);
}

.folder-toggle.expanded i {
    transform: rotate(90deg);
}

.folder-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: inherit;
    flex: 1;
    padding: 5px;
    border-radius: 5px;
    transition: all 0.2s ease;
}

.folder-link:hover {
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
}

.folder-link i {
    color: #f6ad55;
    margin-right: 10px;
    font-size: 1.1rem;
}

.file-icon-placeholder {
    width: 20px;
    margin-right: 8px;
}

.tree-item i.fa-file {
    color: #68d391;
    margin-right: 10px;
    font-size: 1rem;
}

.item-name {
    font-weight: 500;
    font-size: 0.95rem;
}

.file-size {
    margin-left: auto;
    font-size: 0.8rem;
    color: #a0aec0;
    background: #edf2f7;
    padding: 2px 8px;
    border-radius: 12px;
}

.tree-children.collapsed {
    display: none;
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #a0aec0;
}

.empty-state i {
    font-size: 4rem;
    margin-bottom: 20px;
    color: #cbd5e0;
}

.empty-state p {
    font-size: 1.2rem;
}

.tree-item[data-level="0"] > .item-content {
    font-weight: 600;
    font-size: 1rem;
}

.tree-item[data-level="1"] > .item-content {
    font-size: 0.95rem;
}

.tree-item[data-level="2"] > .item-content {
    font-size: 0.9rem;
    opacity: 0.9;
}

.tree-item[data-level="3"] > .item-content {
    font-size: 0.85rem;
    opacity: 0.8;
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    .header {
        padding: 20px;
    }
    
    .header h1 {
        font-size: 2rem;
    }
    
    .main-content {
        padding: 20px;
    }
    
    .tree-children {
        margin-left: 20px;
        padding-left: 10px;
    }
}

/* Animation for folder expansion */
@keyframes slideDown {
    from {
        opacity: 0;
        max-height: 0;
    }
    to {
        opacity: 1;
        max-height: 1000px;
    }
}

.tree-children {
    animation: slideDown 0.3s ease-out;
}
*/

// ===== public/script.js =====
/*
function toggleFolder(button) {
    const treeItem = button.closest('.tree-item');
    const children = treeItem.querySelector('.tree-children');
    
    if (children) {
        children.classList.toggle('collapsed');
        button.classList.toggle('expanded');
        
        // Add smooth animation
        if (!children.classList.contains('collapsed')) {
            children.style.maxHeight = children.scrollHeight + 'px';
        } else {
            children.style.maxHeight = '0';
        }
    }
}

function openFolderInNewTab(event, folderPath) {
    event.preventDefault();
    const newUrl = `/?path=${encodeURIComponent(folderPath)}`;
    window.open(newUrl, '_blank');
}

// Initialize collapsed state for better performance
document.addEventListener('DOMContentLoaded', function() {
    const allChildren = document.querySelectorAll('.tree-children');
    allChildren.forEach(children => {
        const level = parseInt(children.closest('.tree-item').dataset.level);
        if (level > 1) {
            children.classList.add('collapsed');
        }
    });
    
    // Add loading animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// Add keyboard navigation
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Collapse all folders
        document.querySelectorAll('.tree-children').forEach(children => {
            children.classList.add('collapsed');
        });
        document.querySelectorAll('.folder-toggle').forEach(toggle => {
            toggle.classList.remove('expanded');
        });
    }
});
*/

// ===== package.json =====
/*
{
  "name": "folder-structure-explorer",
  "version": "1.0.0",
  "description": "A Node.js app to explore folder structures in a tree format",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ejs": "^3.1.9"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": ["nodejs", "express", "file-explorer", "folder-structure"],
  "author": "Your Name",
  "license": "MIT"
}
*/

// ===== Setup Instructions =====
/*
To set up and run this application:

1. Create a new directory for your project:
   mkdir folder-explorer
   cd folder-explorer

2. Create the following directory structure:
   folder-explorer/
   ├── server.js
   ├── package.json
   ├── views/
   │   ├── index.ejs
   │   └── partials/
   │       └── tree-item.ejs
   └── public/
       ├── styles.css
       └── script.js

3. Copy the code sections above into their respective files:
   - Main server code goes in server.js
   - The EJS template (between comments) goes in views/index.ejs
   - The tree-item partial (between comments) goes in views/partials/tree-item.ejs
   - CSS styles (between comments) go in public/styles.css
   - JavaScript (between comments) goes in public/script.js
   - Package.json content goes in package.json

4. Install dependencies:
   npm install

5. Run the application:
   npm start

6. Open your browser and go to:
   http://localhost:3000

Features:
- Beautiful, modern UI with glassmorphism effects
- Tree-style folder structure display
- Click folders to open them in new tabs
- Collapsible/expandable folders
- Responsive design for mobile devices
- File size display for files
- Smooth animations and hover effects
- Keyboard navigation (ESC to collapse all)
- Automatic filtering of system files and folders

The app will display the current working directory by default, but you can specify a different path using the ?path= query parameter.
*/