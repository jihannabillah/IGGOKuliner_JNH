/**
 * ==============================================================
 * IGGO KULINER — GOOGLE APPS SCRIPT SYNC ENGINE
 * Salin dan Tempel Kode Ini ke Google Sheets (Extensions > Apps Script)
 * ==============================================================
 */

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  // Kunci script selama maks 10 detik agar tidak bentrok saat banyak transaksi
  lock.tryLock(10000);
  
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    
    // Dukung body JSON jika dikirim via fetch POST
    if (e && e.postData && e.postData.contents) {
      try {
        var jsonBody = JSON.parse(e.postData.contents);
        for (var key in jsonBody) {
          params[key] = jsonBody[key];
        }
      } catch (err) {}
    }

    var idMemberQuery = (params.id || "").toString().trim().toLowerCase();
    var action = (params.action || "add").toString().trim().toLowerCase();
    var val = Number(params.value) || 1;

    if (!idMemberQuery) {
      return responseJSON({ success: false, message: "Parameter 'id' member wajib diisi." });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getTargetSheet(ss);
    var data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return responseJSON({ success: false, message: "Lembar spreadsheet kosong." });
    }

    // Deteksi otomatis kolom 'ID MEMBER' dan 'TOTAL CAP'
    var header = data[0];
    var idColIdx = -1;
    var capColIdx = -1;

    for (var c = 0; c < header.length; c++) {
      var h = header[c].toString().trim().toLowerCase();
      if (h.includes("id") && h.includes("member")) {
        idColIdx = c;
      } else if (h.includes("total cap") || h.includes("cap")) {
        capColIdx = c;
      }
    }

    // Fallback jika nama kolom sedikit berbeda (Kolom H & Kolom J)
    if (idColIdx === -1) idColIdx = 7;
    if (capColIdx === -1) capColIdx = 9;

    var targetRow = -1;
    var currentCap = 0;
    var memberName = "";

    // Cari baris member berdasarkan ID (misal: JNH-020)
    for (var r = 1; r < data.length; r++) {
      var rowId = (data[r][idColIdx] || "").toString().trim().toLowerCase();
      if (rowId === idMemberQuery) {
        targetRow = r + 1; // 1-indexed untuk getRange
        currentCap = Number(data[r][capColIdx]) || 0;
        memberName = data[r][1] || ""; // Kolom Nama
        break;
      }
    }

    if (targetRow === -1) {
      return responseJSON({ 
        success: false, 
        message: "ID Member '" + idMemberQuery + "' tidak ditemukan di spreadsheet." 
      });
    }

    var newCap = currentCap;
    if (action === "add") {
      newCap = currentCap + 1;
      if (newCap > 10) newCap = 1; // Siklus loyalitas 10 cap
    } else if (action === "set") {
      newCap = val;
    } else if (action === "reset") {
      newCap = 0;
    } else if (action === "get") {
      return responseJSON({ 
        success: true, 
        id: idMemberQuery, 
        nama: memberName, 
        cap: currentCap 
      });
    }

    // TULIS NILAI CAP BARU LANGSUNG KE SEL GOOGLE SHEETS!
    sheet.getRange(targetRow, capColIdx + 1).setValue(newCap);

    return responseJSON({
      success: true,
      id: idMemberQuery,
      nama: memberName,
      previousCap: currentCap,
      newCap: newCap,
      row: targetRow
    });

  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getTargetSheet(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == 2034393288) {
      return sheets[i];
    }
  }
  return sheets[0];
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
