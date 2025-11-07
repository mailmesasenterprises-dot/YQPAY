const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'TheaterList.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace View buttons
content = content.replace(
  />[\s\n]*🔍 View[\s\n]*</g,
  '>\n                                <svg viewBox="0 0 24 24" fill="currentColor">\n                                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>\n                                </svg>\n                              <'
);

// Replace Remove buttons
content = content.replace(
  />[\s\n]*🗑️ Remove[\s\n]*</g,
  '>\n                                <svg viewBox="0 0 24 24" fill="currentColor">\n                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>\n                                </svg>\n                              <'
);

// Add title attributes to view buttons without them
content = content.replace(
  /(className="preview-btn view-btn"\s+onClick=\{[^}]+\})\s*>/g,
  '$1\n                                title="View"\n                              >'
);

// Add title attributes to remove buttons without them
content = content.replace(
  /(className="preview-btn remove-btn"\s+onClick=\{[^}]+\})\s*>/g,
  '$1\n                                title="Remove"\n                              >'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully replaced all button texts with SVG icons!');
