/**
 * Google Apps Script to Auto-Update Moki Classes (Optimized Batch Version)
 * 
 * INSTRUCTIONS:
 * 1. Ensure your Google Sheet has a column named "ID".
 * 2. Paste this code into Extensions > Apps Script (replace the old one).
 * 3. Run 'updateMokiClasses'.
 * 
 * OPTIMIZATIONS:
 * - Writes data in bulk at the end (orders of magnitude faster).
 * - Fetches APIs in parallel batches (UrlFetchApp.fetchAll).
 * - Checks for time limits to save safely before timeout.
 */

const API_BASE_URL = "https://train.grandarena.gg/api/moki/";
const BATCH_SIZE = 10; // Requests in parallel
const MAX_EXEC_TIME_MS = 300 * 1000; // 5 minutes (limit is 6)

function updateMokiClasses() {
  const startTime = Date.now();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  if (values.length <= 1) return; // No data

  // 1. Find Column Indexes
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  
  const getCol = (name) => headers.indexOf(name.toLowerCase());
  
  const idIdx = getCol("id");
  const classIdx = getCol("class");
  const nameIdx = getCol("name"); 
  const linkIdx = getCol("link"); // New column for marketLink
  
  // Stats
  const elimIdx = getCol("eliminations");
  const depIdx = getCol("deposits");
  const wartIdx = getCol("wartdistance");
  const scoreIdx = getCol("score");
  const winIdx = getCol("winrate");

  const imgIdx = getCol("imageurl");
  const defIdx = getCol("defense");
  const dexIdx = getCol("dexterity");
  const fortIdx = getCol("fortitude");
  const spdIdx = getCol("speed");
  const strIdx = getCol("strength");
  
  // Helper to safely find "Total" or "Total Stats"
  let totalIdx = getCol("total");
  if (totalIdx === -1) totalIdx = getCol("total stats");


  if (idIdx === -1) {
    Logger.log("Error: Column 'ID' not found.");
    SpreadsheetApp.getUi().alert("Error: Column 'ID' not found.");
    return;
  }
  
  var updatedCount = 0;
  
  // Prepare Batches
  let tasks = [];
  
  // Identify rows to process (skip header)
  for (let i = 1; i < values.length; i++) {
    let rawId = values[i][idIdx];
    if (rawId) {
       tasks.push({ 
         rowIndex: i, 
         mokiId: rawId.toString().trim(),
         url: API_BASE_URL + rawId.toString().trim()
       });
    }
  }
  
  Logger.log("Total tasks: " + tasks.length);

  // Process in Batches
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    
    // Safety Check: Time Limit
    if (Date.now() - startTime > MAX_EXEC_TIME_MS) {
       Logger.log("Time limit approaching. Saving progress and stopping.");
       break;
    }

    const batch = tasks.slice(i, i + BATCH_SIZE);
    const requests = batch.map(t => ({
      url: t.url,
      muteHttpExceptions: true
    }));
    
    try {
      // Parallel Fetch
      const responses = UrlFetchApp.fetchAll(requests);
      
      responses.forEach((response, idx) => {
        const task = batch[idx];
        const row = task.rowIndex;
        
        if (response.getResponseCode() === 200) {
           try {
             const data = JSON.parse(response.getContentText());
             
             // Extract Data
             var stats = (data.performance && data.performance.stats) ? data.performance.stats : {};
             var baseStats = (data.gameStats && data.gameStats.stats) ? data.gameStats.stats : {}; 

             // Update "values" array (In-Memory)
             const setVal = (col, val) => {
               if (col !== -1 && val !== undefined && val !== null) {
                 values[row][col] = val;
               }
             };

             setVal(classIdx, data.class);
             setVal(nameIdx, data.name);
             setVal(imgIdx, data.imageUrl);
             
             // Market Link is managed manually by user now, skipping auto-generation.

             setVal(elimIdx, stats.avgKills);
             setVal(depIdx, stats.avgBalls);
             setVal(wartIdx, stats.avgWortDistance);
             setVal(scoreIdx, stats.avgScore);
             setVal(winIdx, stats.winPct);

             if (baseStats.defense) setVal(defIdx, baseStats.defense.total);
             if (baseStats.dexterity) setVal(dexIdx, baseStats.dexterity.total);
             if (baseStats.fortitude) setVal(fortIdx, baseStats.fortitude.total);
             if (baseStats.speed) setVal(spdIdx, baseStats.speed.total);
             if (baseStats.strength) setVal(strIdx, baseStats.strength.total);
             
             // Sum Total Stats if needed (or rely on sheet formula, but we can set it here)
             let total = 0;
             total += (baseStats.defense?.total || 0);
             total += (baseStats.dexterity?.total || 0);
             total += (baseStats.fortitude?.total || 0);
             total += (baseStats.speed?.total || 0);
             total += (baseStats.strength?.total || 0);
             if (total > 0) setVal(totalIdx, total);

             updatedCount++;
             
           } catch(parseErr) {
             Logger.log("Error parsing JSON for ID " + task.mokiId);
           }
        } else {
           Logger.log("Failed ID " + task.mokiId + ": " + response.getResponseCode());
        }
      });
      
    } catch (e) {
      Logger.log("Batch failed: " + e);
    }
    
    // Tiny sleep to be nice to API (but creating new connection overhead is reduced by fetchAll)
    Utilities.sleep(100);
  }
  
  // 3. Bulk Write Changes
  // This is the most crucial step for performance
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  
  Logger.log("Success! Updated " + updatedCount + " rows.");
  SpreadsheetApp.getUi().alert("Updated " + updatedCount + " rows successfully.");
}
