/**
 * Rasuljon ortoped — Lidlar 2026
 * Google Sheets jadvalini avtomatik yaratuvchi skript (1 ta operator uchun).
 *
 * Qanday ishlatish:
 *  1. Google Sheets'da yangi bo'sh jadval oching (sheets.new).
 *  2. Kengaytmalar (Extensions) → Apps Script.
 *  3. Shu faylni to'liq nusxalab qo'ying va saqlang.
 *  4. Yuqoridan "yaratish" funksiyasini tanlab ▶ Run (Ishga tushirish) bosing, ruxsat bering.
 */

const LID_SHEET = 'Lidlar';
const ROWS = 1000;

const MANBALAR = ['Instagram', 'Telegram', 'Facebook', 'TikTok', 'Tanish orqali', "Qo'ng'iroq", 'Boshqa'];
const SHIKOYATLAR = [
  "Bel og'rig'i", 'Umurtqa churrasi', "Bo'yin og'rig'i", "Tizza og'rig'i", "Bo'g'im og'rig'i",
  'Skolioz', 'Yassi oyoqlik', 'Sinish / jarohat', 'Artroz', 'Boshqa'
];
const HOLATLAR = [
  'Yangi', 'Javob bermadi', 'Qayta bog\'lanish', "O'ylab ko'radi",
  'Qabulga yozildi', 'Keldi', 'Kelmadi', 'Rad etdi'
];
const HOLAT_RANG = {
  'Yangi': '#cfe2ff',
  'Javob bermadi': '#fde2e1',
  "Qayta bog'lanish": '#fff3cd',
  "O'ylab ko'radi": '#ffe8cc',
  'Qabulga yozildi': '#d1c4e9',
  'Keldi': '#b7e1cd',
  'Kelmadi': '#f4c7c3',
  'Rad etdi': '#d9d9d9'
};

// A..L ustunlar
const HEADERS = [
  '№', 'Lid sanasi', 'Bemor ismi', 'Telefon', 'Yoshi', 'Manba',
  'Shikoyat', 'Holat', "📞 Qachon bog'lanish", '🏥 Qachon keladi', 'Soat', 'Izoh'
];
const WIDTHS = [45, 95, 170, 130, 55, 110, 150, 135, 140, 130, 65, 260];

function yaratish() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('Rasuljon ortoped — Lidlar 2026');
  ss.setSpreadsheetTimeZone('Asia/Tashkent');
  ss.setSpreadsheetLocale('ru_RU'); // sanani 27.09.2026 ko'rinishida yozish uchun

  const lid = tayyorla_(ss, LID_SHEET, 0);
  lidlarSheet_(lid);
  bugunSheet_(tayyorla_(ss, 'Bugun', 1));
  statistikaSheet_(tayyorla_(ss, 'Statistika', 2));

  // ortiqcha bo'sh "Sheet1 / Лист1" ni o'chirish
  ss.getSheets().forEach(s => {
    if (![LID_SHEET, 'Bugun', 'Statistika'].includes(s.getName())) ss.deleteSheet(s);
  });
  ss.setActiveSheet(lid);
  SpreadsheetApp.getUi().alert('Tayyor! "Lidlar" varag\'iga bemorlarni yozishingiz mumkin.');
}

function tayyorla_(ss, name, index) {
  let sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name, index);
  sh.getBandings().forEach(b => b.remove());
  sh.getDataRange().clearDataValidations();
  sh.clearConditionalFormatRules();
  return sh;
}

function lidlarSheet_(sh) {
  if (sh.getMaxRows() < ROWS + 1) sh.insertRowsAfter(sh.getMaxRows(), ROWS + 1 - sh.getMaxRows());
  if (sh.getMaxColumns() > HEADERS.length) sh.deleteColumns(HEADERS.length + 1, sh.getMaxColumns() - HEADERS.length);

  // Sarlavha
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setBackground('#1f4e79').setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 38);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  WIDTHS.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  const n = ROWS;
  // № avtomatik
  sh.getRange('A2').setFormula('=ARRAYFORMULA(IF(C2:C="","",ROW(C2:C)-1))');
  sh.getRange(2, 1, n).setHorizontalAlignment('center').setFontColor('#888888');

  // Formatlar
  sh.getRange(2, 2, n).setNumberFormat('dd.mm.yyyy');
  sh.getRange(2, 4, n).setNumberFormat('@');
  sh.getRange(2, 9, n).setNumberFormat('dd.mm.yyyy');
  sh.getRange(2, 10, n).setNumberFormat('dd.mm.yyyy');
  sh.getRange(2, 11, n).setNumberFormat('HH:mm');
  sh.getRange(2, 12, n).setWrap(true);
  sh.getRange(2, 1, n, HEADERS.length).setVerticalAlignment('middle').setFontSize(10);
  sh.getRange(2, 5, n).setHorizontalAlignment('center');

  // Tanlov ro'yxatlari (dropdown) va sana tanlagich
  const list = (arr, strict) => SpreadsheetApp.newDataValidation()
    .requireValueInList(arr, true).setAllowInvalid(!strict).build();
  const dateRule = SpreadsheetApp.newDataValidation().requireDate()
    .setAllowInvalid(false).setHelpText('Sanani tanlang (2 marta bosing)').build();

  sh.getRange(2, 2, n).setDataValidation(dateRule);
  sh.getRange(2, 6, n).setDataValidation(list(MANBALAR, false));
  sh.getRange(2, 7, n).setDataValidation(list(SHIKOYATLAR, false));
  sh.getRange(2, 8, n).setDataValidation(list(HOLATLAR, true));
  sh.getRange(2, 9, n).setDataValidation(dateRule);
  sh.getRange(2, 10, n).setDataValidation(dateRule);

  // Chegaralar va yo'l-yo'l fon
  sh.getRange(1, 1, n + 1, HEADERS.length)
    .setBorder(true, true, true, true, true, true, '#d0d7de', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, 1, n + 1, HEADERS.length).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor('#1f4e79');

  // Shartli formatlash
  const rules = [];
  const all = sh.getRange(2, 1, n, HEADERS.length);
  const aktiv = 'AND($H2<>"Keldi",$H2<>"Rad etdi",$H2<>"Kelmadi")';

  // Bugun keladiganlar — yashil qator
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($J2<>"",$J2=TODAY(),$H2<>"Keldi")')
    .setBackground('#c8f7c5').setBold(true).setRanges([all]).build());
  // Bog'lanish muddati o'tib ketgan — qizil
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($I2<>"",$I2<TODAY(),' + aktiv + ')')
    .setBackground('#f8c9c4').setFontColor('#9c0006').setRanges([all]).build());
  // Bugun bog'lanish kerak — sariq
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($I2<>"",$I2=TODAY(),' + aktiv + ')')
    .setBackground('#fff2a8').setBold(true).setRanges([all]).build());
  // Holat ustuni ranglari
  const holat = sh.getRange(2, 8, n);
  Object.keys(HOLAT_RANG).forEach(h => rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(h).setBackground(HOLAT_RANG[h]).setRanges([holat]).build()));
  sh.setConditionalFormatRules(rules);

  // Rang izohi (sarlavha ustidagi eslatma)
  sh.getRange('I1').setNote("🟨 Sariq qator — BUGUN qo'ng'iroq qilish kerak\n🟥 Qizil qator — qo'ng'iroq muddati O'TIB KETGAN\n🟩 Yashil qator — bemor BUGUN keladi");
  sh.getRange('J1').setNote("Bemor qabulga keladigan sana. Soatini 'Soat' ustuniga yozing (masalan 14:30).");
}

function bugunSheet_(sh) {
  sh.setColumnWidths(1, 6, 140);
  sh.setColumnWidth(6, 280);
  sh.getRange('A1').setFormula('="📅 Bugun: "&TEXT(TODAY(),"dd.mm.yyyy")')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1f4e79');

  const blok = (row, title, color, headers, formula) => {
    sh.getRange(row, 1, 1, 6).merge().setValue(title)
      .setBackground(color).setFontWeight('bold').setFontSize(12);
    sh.getRange(row + 1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#eeeeee');
    sh.getRange(row + 2, 1).setFormula(formula);
  };

  // Lidlar!: C ism, D tel, G shikoyat, H holat, I bog'lanish, J keladi, K soat, L izoh
  blok(3, '🏥 BUGUN KELADIGAN BEMORLAR', '#c8f7c5',
    ['Soat', 'Bemor ismi', 'Telefon', 'Shikoyat', 'Holat', 'Izoh'],
    '=IFERROR(SORT(FILTER({TEXT(Lidlar!K2:K,"HH:mm"),Lidlar!C2:C,Lidlar!D2:D,Lidlar!G2:G,Lidlar!H2:H,Lidlar!L2:L},' +
    'Lidlar!J2:J=TODAY(),Lidlar!C2:C<>""),1,TRUE),"Bugun qabulga yozilgan bemor yo\'q")');

  blok(45, "📞 BUGUN QO'NG'IROQ QILISH KERAK (muddati o'tganlar ham)", '#fff2a8',
    ["Bog'lanish sanasi", 'Bemor ismi', 'Telefon', 'Shikoyat', 'Holat', 'Izoh'],
    '=IFERROR(SORT(FILTER({Lidlar!I2:I,Lidlar!C2:C,Lidlar!D2:D,Lidlar!G2:G,Lidlar!H2:H,Lidlar!L2:L},' +
    'Lidlar!I2:I<>"",Lidlar!I2:I<=TODAY(),Lidlar!H2:H<>"Keldi",Lidlar!H2:H<>"Rad etdi",Lidlar!H2:H<>"Kelmadi"),1,TRUE),' +
    '"Bugun qo\'ng\'iroq qilinadigan bemor yo\'q ✅")');
  sh.getRange('A47:A200').setNumberFormat('dd.mm.yyyy');
  sh.setFrozenRows(1);
}

function statistikaSheet_(sh) {
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 90);
  sh.setColumnWidth(3, 30);
  sh.setColumnWidth(4, 180);
  sh.setColumnWidth(5, 90);

  sh.getRange('A1').setValue('📊 Statistika').setFontSize(16).setFontWeight('bold').setFontColor('#1f4e79');

  const umumiy = [
    ['Jami lidlar', '=COUNTA(Lidlar!C2:C)'],
    ['Bugun kelgan lidlar', '=COUNTIF(Lidlar!B2:B,TODAY())'],
    ['Shu oy lidlar', '=COUNTIFS(Lidlar!B2:B,">="&EOMONTH(TODAY(),-1)+1,Lidlar!B2:B,"<="&EOMONTH(TODAY(),0))'],
    ['Bugun keladigan bemorlar', '=COUNTIF(Lidlar!J2:J,TODAY())'],
    ["Bugun qo'ng'iroq kerak", '=COUNTIFS(Lidlar!I2:I,"<="&TODAY(),Lidlar!H2:H,"<>Keldi",Lidlar!H2:H,"<>Rad etdi",Lidlar!H2:H,"<>Kelmadi")'],
    ['Konversiya (Keldi / Jami)', '=IFERROR(COUNTIF(Lidlar!H2:H,"Keldi")/B3,0)']
  ];
  sh.getRange(3, 1, umumiy.length, 2).setValues(umumiy);
  sh.getRange(3, 1, umumiy.length, 1).setFontWeight('bold');
  sh.getRange(3, 2, umumiy.length, 1).setHorizontalAlignment('center').setFontSize(12);
  sh.getRange(3 + umumiy.length - 1, 2).setNumberFormat('0%');

  const jadval = (row, col, title, items, colRef) => {
    sh.getRange(row, col, 1, 2).setValues([[title, 'Soni']])
      .setBackground('#1f4e79').setFontColor('#fff').setFontWeight('bold');
    sh.getRange(row + 1, col, items.length, 2).setValues(items.map(it => [it, '']));
    items.forEach((_, i) => {
      const c = sh.getRange(row + 1 + i, col);
      sh.getRange(row + 1 + i, col + 1)
        .setFormula('=COUNTIF(Lidlar!' + colRef + '2:' + colRef + ',' + c.getA1Notation() + ')')
        .setHorizontalAlignment('center');
    });
  };
  jadval(11, 1, 'Holat bo\'yicha', HOLATLAR, 'H');
  jadval(11, 4, 'Manba bo\'yicha', MANBALAR, 'F');
  jadval(22, 4, 'Shikoyat bo\'yicha', SHIKOYATLAR, 'G');
}

/**
 * Bemor ismi yozilganda "Lid sanasi" bo'sh bo'lsa — bugungi sana avtomatik qo'yiladi,
 * holat bo'sh bo'lsa — "Yangi" qo'yiladi.
 */
function onEdit(e) {
  const r = e.range;
  const sh = r.getSheet();
  if (sh.getName() !== LID_SHEET || r.getColumn() !== 3 || r.getRow() < 2) return;
  for (let i = 0; i < r.getNumRows(); i++) {
    const row = r.getRow() + i;
    if (!sh.getRange(row, 3).getValue()) continue;
    const sana = sh.getRange(row, 2);
    if (!sana.getValue()) sana.setValue(new Date(new Date().toDateString()));
    const holat = sh.getRange(row, 8);
    if (!holat.getValue()) holat.setValue('Yangi');
  }
}
