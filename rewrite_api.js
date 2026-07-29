const fs = require('fs');
const files = [
  'src/views/DonorView.jsx',
  'src/views/HospitalDashboard.jsx',
  'src/views/MediaView.jsx',
  'src/utils/scanner.js',
  'src/hooks/useWebPush.js'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  if (!code.includes('const API_BASE')) {
    code = code.replace(/(import .*;\n)+/, match => match + '\nconst API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";\n');
  }

  code = code.replace(/http:\/\/localhost:5000/g, '${API_BASE}');
  
  // Clean up socket.io("...") or fetch('...') which had double/single quotes to backticks
  code = code.replace(/\"(?:http:\/\/localhost:5000|\$\{API_BASE\})([^\"\n]*)\"/g, '\`${API_BASE}$1\`');
  code = code.replace(/\'(?:http:\/\/localhost:5000|\$\{API_BASE\})([^\'\n]*)\'/g, '\`${API_BASE}$1\`');

  fs.writeFileSync(file, code);
}
console.log('Done');
