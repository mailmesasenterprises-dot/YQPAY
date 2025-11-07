const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'TheaterList.js');
let content = fs.readFileSync(filePath, 'utf8');

// Pattern to match view button with SVG icon - more flexible
const viewButtonPattern = /<button\s+type="button"\s+className="preview-btn view-btn"[\s\S]*?<\/button>\s*/g;

// Check each match to ensure it's a view button with eye icon
content = content.replace(viewButtonPattern, (match) => {
  // Only remove if it contains the eye icon path
  if (match.includes('M12 4.5C7 4.5')) {
    return '';
  }
  return match;
});

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Successfully removed all view button icons!');

