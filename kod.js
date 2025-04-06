function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = e.parameter.action;

  if (action === 'uploadPersonnel') {
    return ContentService.createTextOutput(JSON.stringify(uploadPersonnelServer(data.base64Data)))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'downloadPersonnel') {
    return ContentService.createTextOutput(downloadPersonnelServer(data.persons))
      .setMimeType(ContentService.MimeType.TEXT);
  } else if (action === 'sendEmail') {
    return ContentService.createTextOutput(sendEmail(data.recipient, data.base64Data, data.fileName))
      .setMimeType(ContentService.MimeType.TEXT);
  } else {
    // Varsayılan olarak optimize işlemini çalıştır
    var result = optimize(data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function uploadPersonnelServer(base64Data) {
  try {
    Logger.log("Yükleme işlemi başladı. Base64 veri uzunluğu: " + (base64Data ? base64Data.length : 'null'));
    if (!base64Data || base64Data.length === 0) {
      Logger.log("Veri boş veya geçersiz!");
      return { success: false, error: 'Gönderilen veri boş veya geçersiz!' };
    }

    // Base64 string'i decode etme
    const decodedData = Utilities.base64Decode(base64Data);
    const text = Utilities.newBlob(decodedData).getDataAsString('utf-8');
    Logger.log("Dosya içeriği (ilk 100 karakter): " + text.substring(0, 100) + (text.length > 100 ? '...' : ''));

    if (!text || text.trim() === '') {
      Logger.log("Dosya içeriği boş!");
      return { success: false, error: 'CSV dosyası içeriği boş!' };
    }

    const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
    Logger.log("Satır sayısı: " + rows.length);
    if (rows.length < 1) {
      Logger.log("Dosya boş veya geçersiz format!");
      return { success: false, error: 'CSV dosyası boş veya geçersiz formatta!' };
    }

    const headers = rows[0].map(header => header.replace(/"/g, '').trim());
    Logger.log("Başlıklar: " + headers.join(','));
    if (headers.length < 1 || headers[0] !== 'İsim') {
      Logger.log("Başlık satırı geçersiz: " + headers.join(','));
      return { success: false, error: 'CSV dosyası geçersiz bir formatta! Lütfen başlık satırını kontrol edin: İsim' };
    }

    const persons = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      Logger.log("Satır " + i + ": " + row.join(','));
      if (row.length >= 1 && row[0]) {
        const name = row[0].replace(/"/g, '').trim().toUpperCase();
        if (name) {
          persons.push({
            name: name,
            weekdayDuties: undefined,
            weekendDuties: undefined,
            minDaysBetween: 1
          });
        }
      }
    }

    if (persons.length === 0) {
      Logger.log("Geçerli personel verisi bulunamadı.");
      return { success: false, error: 'CSV dosyasında geçerli personel verisi bulunamadı!' };
    }

    const uniquePersons = [];
    const seenNames = new Set();
    let hasDuplicates = false;
    persons.forEach(person => {
      if (person.name && !seenNames.has(person.name)) {
        seenNames.add(person.name);
        uniquePersons.push(person);
      } else if (person.name) {
        hasDuplicates = true;
      }
    });

    if (hasDuplicates) {
      Logger.log("Yinelenen isimler bulundu.");
      return { success: false, error: 'CSV dosyasında yinelenen personel isimleri bulundu!' };
    }

    Logger.log("Yükleme başarılı. Personeller: " + JSON.stringify(uniquePersons));
    return { success: true, persons: uniquePersons };
  } catch (e) {
    Logger.log("Yükleme hatası: " + e.message + " - Stack: " + e.stack);
    return { success: false, error: 'CSV dosyası işlenirken bir hata oluştu: ' + e.message };
  }
}

function downloadPersonnelServer(persons) {
  const csvRows = [];
  const headers = ['İsim'];
  csvRows.push(headers.join(','));

  persons.forEach(person => {
    const row = [`"${person.name}"`];
    csvRows.push(row.join(','));
  });

  const BOM = "\uFEFF";
  return BOM + csvRows.join('\n');
}

function optimize(data) {
  var url = 'https://deneme-174463354439.europe-west4.run.app';
  
  Logger.log('İstek gönderiliyor: ' + JSON.stringify(data));
  
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(data),
    'muteHttpExceptions': true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();
  
  Logger.log('Yanıt alındı: Code=' + responseCode + ', Body=' + responseBody);
  
  if (responseCode === 200) {
    var result = JSON.parse(responseBody);
    if (result.assignments) {
        return result.assignments;
    } else {
        Logger.log('Parsed Response: ' + JSON.stringify(result));
        return { error: result.error || 'Bilinmeyen bir hata oluştu' };
    }
  } else {
    var result = JSON.parse(responseBody);
    return { error: result.error || 'Sunucuyla iletişim kurulamadı, lütfen tekrar deneyin' };
  }
}

function sendEmail(recipient, base64Data, fileName) {
  try {
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName);
    
    const subject = "Nöbet Listesi";
    const body = "Nöbet listesi ektedir.";
    
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: body,
      attachments: [blob]
    });
    
    return "E-posta başarıyla gönderildi.";
  } catch (e) {
    Logger.log("E-posta gönderme hatası: " + e);
    throw new Error("E-posta gönderilirken hata oluştu: " + e.message);
  }
}
