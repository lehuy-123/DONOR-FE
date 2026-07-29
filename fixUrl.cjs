const fs = require('fs');
const path = require('path');

const targetUrl = 'import.meta.env.VITE_API_URL || "https://donor-be.onrender.com"';

const files = [
  'src/views/DonorView.jsx',
  'src/views/HospitalDashboard.jsx',
  'src/views/MediaView.jsx',
  'src/utils/scanner.js',
  'src/hooks/useWebPush.js',
  'src/utils/firestore.js'
];

for (let file of files) {
  let fullPath = path.resolve(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let code = fs.readFileSync(fullPath, 'utf8');

    // Make sure API_BASE is declared at the top if it's not there
    if (!code.includes('const API_BASE =')) {
      code = code.replace(/import\s+.*?;?\n/, match => match + '\nconst API_BASE = ' + targetUrl + ';\n');
    } else {
        // Update API_BASE if it exists pointing to something else
        code = code.replace(/const API_BASE = .*;/g, 'const API_BASE = ' + targetUrl + ';');
    }

    // Replace regular ticks with dynamic variables
    code = code.replace(/http:\/\/localhost:5000/g, '${API_BASE}');

    // We must ensure that any API calls that were using double quotes now use backticks because we inject ${API_BASE}
    // example: io("http://localhost:5000") -> io(`${API_BASE}`) 
    // Since we just replaced http://localhost:5000 with ${API_BASE}, let's find strings wrapping ${API_BASE} and convert quotes to backticks
    code = code.replace(/"(\$\{API_BASE\}[^"]*)"/g, '\`$1\`');
    code = code.replace(/'(\$\{API_BASE\}[^']*)'/g, '\`$1\`');

    fs.writeFileSync(fullPath, code, 'utf8');
    console.log('Fixed', file);
  }
}
