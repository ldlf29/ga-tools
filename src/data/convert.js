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

const csvPath = path.join(__dirname, 'catalog.csv');
const jsonPath = path.join(__dirname, 'catalog.json');

const csvText = fs.readFileSync(csvPath, 'utf8');
const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);

if (lines.length >= 2) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const getIndex = (n) => headers.indexOf(n.toLowerCase());

    const idxId = getIndex('ID');
    const idxName = getIndex('Name');
    const idxRarity = getIndex('Rarity');
    let idxImg = getIndex('cardImage');
    if (idxImg === -1) idxImg = getIndex('ImageURL');
    const idxDesc = getIndex('Description');

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[idxName]) continue;
        data.push({
            id: idxId !== -1 ? cols[idxId]?.trim() : `item-${i}`,
            name: cols[idxName]?.trim(),
            rarity: idxRarity !== -1 ? cols[idxRarity]?.trim() : 'Basic',
            image: optimizeImageUrl(idxImg !== -1 ? cols[idxImg]?.trim() : ''),
            description: idxDesc !== -1 ? cols[idxDesc]?.trim() : undefined
        });
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    console.log(`Successfully converted ${data.length} entries to catalog.json`);
}
