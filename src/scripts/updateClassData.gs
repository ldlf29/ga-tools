/**
 * Google Apps Script to Auto-Update Moki Classes (By ID)
 * 
 * INSTRUCTIONS:
 * 1. Ensure your Google Sheet has a column named "ID".
 * 2. Paste this code into Extensions > Apps Script.
 * 3. Run 'updateMokiClasses' to test.
 * 4. Set a Time-driven trigger (e.g. every 6 hours).
 */

const API_BASE_URL = "https://train.grandarena.gg/api/moki/";

function updateMokiClasses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  if (values.length <= 1) return; // No data

  // 1. Find Column Indexes
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const idIdx = headers.indexOf("id");
  const classIdx = headers.indexOf("class");
  const nameIdx = headers.indexOf("name"); 
  
  const elimIdx = headers.indexOf("eliminations");
  const depIdx = headers.indexOf("deposits");
  const wartIdx = headers.indexOf("wartdistance");
  const scoreIdx = headers.indexOf("score");
  const winIdx = headers.indexOf("winrate");

  const imgIdx = headers.indexOf("imageurl");
  const defIdx = headers.indexOf("defense");
  const dexIdx = headers.indexOf("dexterity");
  const fortIdx = headers.indexOf("fortitude");
  const spdIdx = headers.indexOf("speed");
  const strIdx = headers.indexOf("strength");

  // Log which columns were found
  Logger.log("Columns found: Class=" + classIdx + ", Elim=" + elimIdx + ", Img=" + imgIdx + ", Str=" + strIdx);

  if (idIdx === -1) {
    Logger.log("Error: Column 'ID' not found.");
    return;
  }
  
  var updatedCount = 0;

  // 2. Iterate Rows
  for (var i = 1; i < values.length; i++) {
    var rawId = values[i][idIdx];
    if (!rawId) continue;
    
    var mokiId = rawId.toString().trim();
    var rowUpdated = false;
    
    try {
      var url = API_BASE_URL + mokiId;
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      
      if (response.getResponseCode() === 200) {
        var data = JSON.parse(response.getContentText());
        
        // Correct Structure based on logs:
        // gameStats -> stats -> defense -> { total }
        
        var stats = (data.performance && data.performance.stats) ? data.performance.stats : {};
        var baseStats = (data.gameStats && data.gameStats.stats) ? data.gameStats.stats : {}; 

        // Helper to update if changed
        const checkAndUpdate = (colIdx, newVal) => {
          if (colIdx !== -1 && newVal !== undefined && newVal !== null) {
             var currentVal = values[i][colIdx];
             if (currentVal != newVal) { 
                sheet.getRange(i + 1, colIdx + 1).setValue(newVal);
                rowUpdated = true;
             }
          }
        };

        checkAndUpdate(classIdx, data.class);
        checkAndUpdate(nameIdx, data.name);
        checkAndUpdate(imgIdx, data.imageUrl);
        
        // Mapped Stats
        checkAndUpdate(elimIdx, stats.avgKills);      // eliminations <- avgKills
        checkAndUpdate(depIdx, stats.avgBalls);       // deposits <- avgBalls
        checkAndUpdate(wartIdx, stats.avgWortDistance); // wartDistance <- avgWortDistance
        checkAndUpdate(scoreIdx, stats.avgScore);     // score <- avgScore
        checkAndUpdate(winIdx, stats.winPct);         // winRate <- winPct

        // Base Stats (Total)
        if (baseStats.defense) checkAndUpdate(defIdx, baseStats.defense.total);
        if (baseStats.dexterity) checkAndUpdate(dexIdx, baseStats.dexterity.total);
        if (baseStats.fortitude) checkAndUpdate(fortIdx, baseStats.fortitude.total);
        if (baseStats.speed) checkAndUpdate(spdIdx, baseStats.speed.total);
        if (baseStats.strength) checkAndUpdate(strIdx, baseStats.strength.total);

        if (rowUpdated) updatedCount++;

      } else {
        Logger.log("Failed to fetch ID " + mokiId + ": " + response.getResponseCode());
      }
      
      // Be polite (User script used 2000ms, lets use that to be safe)
      Utilities.sleep(2000); 
 
      
    } catch (e) {
      Logger.log("Error processing ID " + mokiId + ": " + e);
    }
  }
  
  Logger.log("Finished. Updated matching rows: " + updatedCount);
}
