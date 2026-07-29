const fs = require('fs');
let code = fs.readFileSync('src/views/DonorView.jsx', 'utf8');

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
    
    // We count open and close divs to find the matching one
    // But since the lines could have multiple tags, let's just count <div and </div 
    for (let i = startLine; i < lines.length; i++) {
        let line = lines[i];
        let opens = (line.match(/<div/g) || []).length;
        let closes = (line.match(/<\/div/g) || []).length;
        
        divCount += opens;
        divCount -= closes;
        
        if (divCount === 0 && opens > 0 || (divCount === 0 && opens === 0 && closes > 0)) {
            endLine = i;
            break;
        }
    }
    return { start: startLine, end: endLine, content: lines.slice(startLine, endLine + 1) };
}

let chatBlock = extractBlock('id="chat-room-section"');
let bulletinBlock = extractBlock('className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-5 shadow-inner flex flex-col max-h-[40rem]"');

if (chatBlock && bulletinBlock) {
    let lines = code.split('\n');
    
    // Replace chatBlock area with bulletinBlock.content
    // Replace bulletinBlock area with chatBlock.content
    // Must do bottom to top to avoid shifting indices
    
    if (chatBlock.start > bulletinBlock.start) {
        lines.splice(chatBlock.start, chatBlock.end - chatBlock.start + 1, ...bulletinBlock.content);
        lines.splice(bulletinBlock.start, bulletinBlock.end - bulletinBlock.start + 1, ...chatBlock.content);
    } else {
        lines.splice(bulletinBlock.start, bulletinBlock.end - bulletinBlock.start + 1, ...chatBlock.content);
        lines.splice(chatBlock.start, chatBlock.end - chatBlock.start + 1, ...bulletinBlock.content);
    }
    
    fs.writeFileSync('src/views/DonorView.jsx', lines.join('\n'));
    console.log("Swapped dynamically successfully");
} else {
    console.log("Could not find blocks");
}
