const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'TheaterList.js');
let content = fs.readFileSync(filePath, 'utf8');

// Documents to update (remaining ones)
const documents = [
  { field: 'panCard', fileName: 'pan-card.pdf' },
  { field: 'gstCertificate', fileName: 'gst-certificate.pdf' },
  { field: 'fssaiCertificate', fileName: 'fssai-certificate.pdf' },
  { field: 'agreementCopy', fileName: 'agreement-copy.pdf' }
];

documents.forEach(doc => {
  // Find pattern: image tag followed by document-placeholder
  const regex = new RegExp(
    `(<img\\s+src=\\{viewModal\\.theater\\.documents\\.${doc.field}\\}[^>]*/>)\\s*(<div className="document-placeholder" style=\\{\\{display: 'none'\\}\\}>)`,
    'g'
  );
  
  content = content.replace(regex, `$1
                            <button
                              onClick={() => handleDownloadFile(viewModal.theater.documents.${doc.field}, '${doc.fileName}')}
                              className="action-btn download-btn download-btn-overlay"
                              title="Download"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                            </button>
                            $2`);
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Successfully added download button overlays to remaining documents!');

