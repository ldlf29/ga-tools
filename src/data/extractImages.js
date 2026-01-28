const fs = require('fs');
const path = require('path');

function optimizeImageUrl(url) {
    if (!url) return url;
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
        if (url.includes('=') && !url.includes('?')) {
            return url.split('=')[0] + '=s0';
        }
    }
    if (url.includes('drive.google.com/uc?')) {
        if (!url.includes('&sz=')) {
            return url + '&sz=s0';
        }
    }
    return url;
}

function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                cur += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
    }
    result.push(cur);
    return result;
}

const statsCsvPath = path.join(__dirname, 'stats_temp.csv');
const mokiImagesPath = path.join(__dirname, 'mokiImages.json');

const csvText = fs.readFileSync(statsCsvPath, 'utf8');
const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);

if (lines.length >= 2) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const getIndex = (n) => headers.indexOf(n.toLowerCase());

    const idxName = getIndex('Name');
    let idxImg = getIndex('Image URL');
    if (idxImg === -1) idxImg = getIndex('ImageURL'); // Try without space

    if (idxName !== -1 && idxImg !== -1) {
        const imageMap = {};
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const name = cols[idxName]?.trim();
            const imgUrl = cols[idxImg]?.trim();
            if (name && imgUrl) {
                imageMap[name.toUpperCase()] = optimizeImageUrl(imgUrl);
            }
        }
        fs.writeFileSync(mokiImagesPath, JSON.stringify(imageMap, null, 2));
        console.log(`Successfully mapped images for ${Object.keys(imageMap).length} Mokis to mokiImages.json`);
    } else {
        console.error(`Columns not found. Name:${idxName}, ImageURL:${idxImg}`);
        console.log("Headers found:", headers);
    }
}
