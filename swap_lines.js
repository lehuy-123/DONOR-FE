import fs from 'fs';

const lines = fs.readFileSync('src/views/DonorView.jsx', 'utf8').split(/\r?\n/);

let b1_start = -1, b1_end = -1;
let b2_start = -1, b2_end = -1;
let rightCol_marker = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('BẢNG TIN BỆNH VIỆN') && b1_start === -1) {
    b1_start = i - 2; 
  }
  if (lines[i].includes('CỘT PHẢI: TRẠNG THÁI VÀ CHAT LIVE')) {
    rightCol_marker = i;
    b1_end = i - 2;
  }
  if (lines[i].includes('MESSAGE ROOM CHUYÊN NGHIỆP')) {
    b2_start = i;
  }
}

for (let i = b2_start; i < lines.length; i++) {
  if (lines[i].trim() === '</div>' && lines[i+1]?.trim() === '</div>' && lines[i+2]?.trim() === ');') {
    b2_end = i - 1; 
    break;
  }
}

console.log('B1:', b1_start, b1_end);
console.log('R:', rightCol_marker);
console.log('B2:', b2_start, b2_end);

if (b1_start !== -1 && b1_end !== -1 && b2_start !== -1 && b2_end !== -1) {
    const partA = lines.slice(0, b1_start);
    const block1 = lines.slice(b1_start, b1_end + 1);
    const partB = lines.slice(b1_end + 1, b2_start);
    const block2 = lines.slice(b2_start, b2_end + 1);
    const partC = lines.slice(b2_end + 1);

    const newLines = [...partA, ...block2, ...partB, ...block1, ...partC];
    fs.writeFileSync('src/views/DonorView.jsx', newLines.join('\n'));
    console.log("SWAP OK!");
} else {
    console.log("SWAP FAILED");
}
