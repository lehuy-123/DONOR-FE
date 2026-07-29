const fs = require('fs');
let code = fs.readFileSync('c:/Users/Tinh Tam/Videos/DONOR3/DONOR/frontend/src/views/DonorView.jsx', 'utf8');

function extractBlock(startMarker) {
    let lines = code.split('\n');
    let startLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(startMarker)) {
            startLine = i;
            break;
        }
    }
    if (startLine === -1) return null;

    let endLine = startLine;
    let divCount = 0;
    
    for (let i = startLine; i < lines.length; i++) {
        let line = lines[i];
        let opens = (line.match(/<div/g) || []).length;
        let closes = (line.match(/<\/div/g) || []).length;
        
        divCount += opens;
        divCount -= closes;
        
        if ((divCount === 0 && opens > 0) || (divCount === 0 && opens === 0 && closes > 0)) {
            endLine = i;
            break;
        }
    }
    return { start: startLine, end: endLine, content: lines.slice(startLine, endLine + 1) };
}

let gpsBlock = extractBlock(' {/* GPS & RADAR CHECK */}');
let rightCol = extractBlock(' {/* CỘT PHẢI: TRẠNG THÁI VÀ CHAT LIVE (Col 8/12) */}');

if (gpsBlock && rightCol) {
    let lines = code.split('\n');
    
    // We want to remove gpsBlock from its current location, and append it to the end of rightCol.
    // However, rightCol contains an opening and a closing div for the column itself!
    // We should insert gpsBlock content just BEFORE the closing div of rightCol.
    // The closing div of rightCol is at rightCol.end.
    
    let originalGpsLength = gpsBlock.end - gpsBlock.start + 1;
    
    if (gpsBlock.start < rightCol.start) {
        // Because gpsBlock is above rightCol, removing it will shift rightCol's indices
        // So we extract lines first
        let beforeGps = lines.slice(0, gpsBlock.start);
        let afterGpsBeforeRightCol = lines.slice(gpsBlock.end + 1, rightCol.start);
        let rightColContentWithoutEnd = lines.slice(rightCol.start, rightCol.end);
        let rightColEndLine = lines.slice(rightCol.end, rightCol.end + 1);
        let afterRightCol = lines.slice(rightCol.end + 1);
        
        let newLines = [
            ...beforeGps,
            ...afterGpsBeforeRightCol,
            ...rightColContentWithoutEnd,
            ...gpsBlock.content,
            ...rightColEndLine,
            ...afterRightCol
        ];
        
        fs.writeFileSync('c:/Users/Tinh Tam/Videos/DONOR3/DONOR/frontend/src/views/DonorView.jsx', newLines.join('\n'));
        console.log("Moved GPS block successfully");
    } else {
        console.log("Logic expects GPS block to be before Right Col (Col 8/12)");
    }
} else {
    console.log("Could not find blocks");
}
