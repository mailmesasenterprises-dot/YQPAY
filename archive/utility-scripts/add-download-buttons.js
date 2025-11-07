const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'TheaterList.js');
let content = fs.readFileSync(filePath, 'utf8');

// Define documents to update with their file names
const documents = [
  { field: 'logo', fileName: 'theater-logo.png', label: 'Theater Logo' },
  { field: 'aadharCard', fileName: 'aadhar-card.pdf', label: 'Aadhar Card' },
  { field: 'panCard', fileName: 'pan-card.pdf', label: 'PAN Card' },
  { field: 'gstCertificate', fileName: 'gst-certificate.pdf', label: 'GST Certificate' },
  { field: 'fssaiCertificate', fileName: 'fssai-certificate.pdf', label: 'FSSAI Certificate' },
  { field: 'agreementCopy', fileName: 'agreement-copy.pdf', label: 'Agreement Copy' }
];

documents.forEach(doc => {
  // Pattern to find the View Full Size link and add download button after it
  const pattern = new RegExp(
    `(<a\\s+href=\\{viewModal\\.theater\\.documents\\?\\.${doc.field}[^}]*\\}\\s+target="_blank"\\s+rel="noopener noreferrer"\\s+className="view-document-btn"\\s*>\\s*View Full Size\\s*</a>)`,
    'g'
  );
  
  const replacement = `$1
                              <button
                                onClick={() => handleDownloadFile(viewModal.theater.documents.${doc.field}, '${doc.fileName}')}
                                className="action-btn download-btn"
                                title="Download"
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                                </svg>
                              </button>`;
  
  content = content.replace(pattern, replacement);
});

// Special handling for logo which has different path pattern
const logoPattern = /<a\s+href=\{viewModal\.theater\.documents\?\.logo \|\| viewModal\.theater\.branding\?\.logo \|\| viewModal\.theater\.branding\?\.logoUrl\}\s+target="_blank"\s+rel="noopener noreferrer"\s+className="view-document-btn"\s*>\s*View Full Size\s*<\/a>/g;

const logoReplacement = `<a 
                              href={viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Full Size
                            </a>
                            <button
                              onClick={() => handleDownloadFile(viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl, 'theater-logo.png')}
                              className="action-btn download-btn"
                              title="Download"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                            </button>`;

content = content.replace(logoPattern, logoReplacement);

// Now wrap all "View Full Size" + download button combinations in a document-actions div
content = content.replace(
  /(View Full Size\s*<\/a>)\s*(<button[^>]*className="action-btn download-btn"[^>]*>[\s\S]*?<\/button>)/g,
  `View Full Size
                            </a>
                            </div>
                            <div className="document-actions">
                              <a 
                                href={viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="view-document-btn"
                              >
                                View Full Size
                              </a>
                              $2
                            </div>`
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Successfully added download buttons to all documents!');
