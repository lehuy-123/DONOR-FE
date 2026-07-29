import fs from 'fs';

try {
  let code = fs.readFileSync('src/views/DonorView.jsx', 'utf8');

  const marker1 = '          <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-5 shadow-inner flex flex-col max-h-[40rem]">';
  const marker2 = '{/* CỘT PHẢI: TRẠNG THÁI VÀ CHAT LIVE (Col 8/12) */}';
  const marker3 = '          {/* MESSAGE ROOM CHUYÊN NGHIỆP */}';
  
  const b1Start = code.indexOf(marker1);
  const rightColMarker = code.indexOf(marker2);
  // b1 ends before the rightColMarker. Let's find the closing </div> of the left col.
  const b1End = code.lastIndexOf('</div>', rightColMarker) + 6; 
  const block1 = code.substring(b1Start, b1End);

  const b2Start = code.indexOf(marker3);
  // b2 ends right before the closing div of the grid.
  // We can just find the end of the file and walk back.
  const b2End = code.indexOf('export default DonorView') - 1;
  const block2 = code.substring(b2Start, b2End);

  if (b1Start > 0 && b1End > b1Start && b2Start > 0 && b2End > b2Start) {
     const partA = code.substring(0, b1Start); 
     const partB = code.substring(b1End, b2Start);
     const partC = code.substring(b2End);

     const newCode = partA + block2 + "\n" + partB + "\n" + block1 + "\n" + partC;
     fs.writeFileSync('src/views/DonorView.jsx', newCode);
     console.log("SWAP SUCCESSFUL!", block1.length, block2.length);
  } else {
     console.log("Failed to find boundaries", {b1Start, b1End, b2Start, b2End});
  }
} catch (err) {
  console.error("ERROR:", err);
}
