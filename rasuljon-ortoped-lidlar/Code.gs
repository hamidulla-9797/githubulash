/**
 * Rasuljon ortoped lid — operator varag'i
 *
 * Meta (Facebook/Instagram) lid formasi yozayotgan xom varaqqa TEGMAYDI.
 * Yangi lidlarni "Operator" varag'iga ko'chiradi (ID bo'yicha, takrorlanmaydi),
 * operator esa Holat / Qachon bog'lanish / Qachon keladi / Izoh ustunlarini to'ldiradi.
 *
 * O'rnatish (1 marta, jadval egasi qiladi):
 *  1. Jadvalni oching → Расширения (Kengaytmalar) → Apps Script.
 *  2. Bor kodni o'chirib, shu kodni qo'ying, 💾 saqlang.
 *  3. Yuqoridagi ro'yxatdan "sozlash" ni tanlab ▶ Выполнить bosing, ruxsat bering.
 * Shundan keyin yangi lidlar har 5 daqiqada o'zi tushadi.
 * Boshqa odamlarga oddiy "Редактор" dostupi bersangiz yetarli.
 */

const OP = 'Operator';
const BUGUN = 'Bugun';
const STAT = 'Statistika';
const BUFER = 3000; // oldindan formatlanadigan qatorlar

const HOLATLAR = {
  'Yangi': '#cfe2ff',
  'Javob bermadi': '#fde2e1',
  "Qayta bog'lanish": '#fff3cd',
  "O'ylab ko'radi": '#ffe8cc',
  'Qabulga yozildi': '#d1c4e9',
  'Keldi': '#b7e1cd',
  'Kelmadi': '#f4c7c3',
  'Rad etdi': '#d9d9d9',
  'Noto\'g\'ri raqam': '#d9d9d9'
};
const YOPIQ = ['Keldi', 'Kelmadi', 'Rad etdi', "Noto'g'ri raqam"];

// A..P — avtomatik (A..J) va operator (K..O) ustunlari
const HEADERS = [
  '№', 'Lid vaqti', 'Bemor ismi', 'Telefon', 'Manzil', 'Shikoyat', "Og'riq qachondan",
  'MRT / rentgen', 'Bemor: qachon kelmoqchi', 'Manba',
  'Holat', "📞 Qachon bog'lanish", '🏥 Qachon keladi', 'Soat', 'Izoh', 'Lead ID'
];
const WIDTHS = [40, 110, 150, 175, 130, 170, 110, 150, 120, 150, 135, 120, 115, 55, 260, 60];
const C = { NUM: 1, VAQT: 2, ISM: 3, TEL: 4, HOLAT: 11, BOG: 12, KEL: 13, SOAT: 14, IZOH: 15, ID: 16 };

/* ------------------------------ Menyu ------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🦴 Lidlar')
    .addItem('Yangi lidlarni hozir olish', 'yangiLidlar')
    .addItem('Bugun varag\'ini ochish', 'bugunniOch')
    .addSeparator()
    .addItem('Qayta sozlash (egasi uchun)', 'sozlash')
    .addToUi();
}

function bugunniOch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setActiveSheet(ss.getSheetByName(BUGUN));
}

/* ------------------------------ Sozlash ------------------------------ */

function sozlash() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Tashkent');
  if (!xomVaraq_(ss)) throw new Error('1-qatorida "created_time" bor varaq topilmadi.');

  let op = ss.getSheetByName(OP);
  if (!op) op = ss.insertSheet(OP, 0);
  operatorVarag_(op);
  bugunVarag_(ss);
  statistikaVarag_(ss);

  // Har 5 daqiqada yangi lidlarni olish (eski triggerlarni tozalab)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'yangiLidlar')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('yangiLidlar').timeBased().everyMinutes(5).create();

  const n = yangiLidlar();
  ss.setActiveSheet(op);
  SpreadsheetApp.getUi().alert('Tayyor! ' + n + ' ta lid "Operator" varag\'iga ko\'chirildi.\n' +
    'Yangi lidlar har 5 daqiqada o\'zi tushadi.');
}

function operatorVarag_(sh) {
  if (sh.getMaxColumns() < HEADERS.length) sh.insertColumnsAfter(sh.getMaxColumns(), HEADERS.length - sh.getMaxColumns());
  if (sh.getMaxColumns() > HEADERS.length) sh.deleteColumns(HEADERS.length + 1, sh.getMaxColumns() - HEADERS.length);

  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setFontColor('#ffffff').setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, 10).setBackground('#1f4e79');                 // formadan keladi
  sh.getRange(1, C.HOLAT, 1, 5).setBackground('#e67e22');           // operator to'ldiradi
  sh.getRange(1, C.ID).setBackground('#999999');
  sh.setRowHeight(1, 40);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(C.TEL);
  WIDTHS.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.hideColumns(C.ID);

  sh.getRange('B1').setNote('Ko\'k ustunlar — formadan avtomatik keladi.\nTo\'q sariq ustunlar — operator to\'ldiradi.');
  sh.getRange('L1').setNote("🟨 Sariq qator — BUGUN qo'ng'iroq qilish kerak\n🟥 Qizil qator — qo'ng'iroq kuni O'TIB KETGAN\n🟩 Yashil qator — bemor BUGUN keladi\n🔵 Ko'k holat — hali hech kim bog'lanmagan");
  sh.getRange('K1').setNote("\"Javob bermadi\" tanlansa, qo'ng'iroq sanasi o'zi ertaga qo'yiladi.");

  formatla_(sh);


  // Formadan keladigan ustunlarni tasodifan o'zgartirishdan ogohlantirish
  himoya_(sh, 'avto', sh.getRange('B2:J'));
}

/** Eski himoyani olib, faqat ogohlantiruvchi yangi himoya qo'yadi (qayta sozlashda takrorlanmasin) */
function himoya_(sh, nom, range) {
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter(p => p.getDescription() === nom).forEach(p => p.remove());
  range.protect().setDescription(nom).setWarningOnly(true);
}

/** Validatsiya, sana formati va ranglarni butun bufer bo'yicha qo'yadi. */
function formatla_(sh) {
  const kerak = Math.max(sh.getLastRow() + 500, BUFER);
  if (sh.getMaxRows() < kerak + 1) sh.insertRowsAfter(sh.getMaxRows(), kerak + 1 - sh.getMaxRows());
  const n = sh.getMaxRows() - 1;

  sh.getRange(2, 1, n, HEADERS.length).setVerticalAlignment('middle').setFontSize(10);
  sh.getRange(2, C.NUM, n).setHorizontalAlignment('center').setFontColor('#888888');
  sh.getRange(2, C.VAQT, n).setNumberFormat('dd.mm.yyyy HH:mm');
  sh.getRange(2, C.TEL, n).setNumberFormat('@');
  sh.getRange(2, C.BOG, n, 2).setNumberFormat('dd.mm.yyyy').setHorizontalAlignment('center');
  sh.getRange(2, C.SOAT, n).setNumberFormat('HH:mm').setHorizontalAlignment('center');
  sh.getRange(2, C.IZOH, n).setWrap(true);

  const sana = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
    .setHelpText('Sanani tanlash uchun katakni 2 marta bosing').build();
  sh.getRange(2, C.HOLAT, n).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(HOLATLAR), true).setAllowInvalid(false).build());
  sh.getRange(2, C.BOG, n, 2).setDataValidation(sana);

  const all = sh.getRange(2, 1, n, HEADERS.length - 1);
  const ochiq = YOPIQ.map(h => '$K2<>"' + h + '"').join(',');
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($M2<>"",$M2=TODAY(),$K2<>"Keldi")')
      .setBackground('#c8f7c5').setBold(true).setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($L2<>"",$L2<TODAY(),' + ochiq + ')')
      .setBackground('#f8c9c4').setFontColor('#9c0006').setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($L2<>"",$L2=TODAY(),' + ochiq + ')')
      .setBackground('#fff2a8').setBold(true).setRanges([all]).build()
  ];
  const holat = sh.getRange(2, C.HOLAT, n);
  Object.keys(HOLATLAR).forEach(h => rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(h).setBackground(HOLATLAR[h]).setRanges([holat]).build()));
  sh.setConditionalFormatRules(rules);

  // Filtr butun jadvalni qamrab olsin
  const f = sh.getFilter();
  if (f && f.getRange().getLastRow() < sh.getMaxRows()) f.remove();
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).createFilter();
}

/* --------------------------- Lidlarni ko'chirish --------------------------- */

/** Xom varaqdagi yangi lidlarni Operator varag'i oxiriga qo'shadi. Qo'shilganlar sonini qaytaradi. */
function yangiLidlar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 0;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const op = ss.getSheetByName(OP);
    const xom = xomVaraq_(ss);
    if (!op || !xom || xom.getLastRow() < 2) return 0;

    const data = xom.getDataRange().getDisplayValues();
    const h = data[0].map(s => String(s).toLowerCase());
    const col = (re, fallback) => { const i = h.findIndex(x => re.test(x)); return i >= 0 ? i : fallback; };
    const k = {
      id: col(/^id$/, 0),
      vaqt: col(/^created_time$/, 1),
      adset: col(/^adset_name$/, 5),
      platform: col(/^platform$/, 11),
      shikoyat: col(/нима|безовта/, 12),
      qachondan: col(/^о[гғ]ри[кқ]|қанча_ва|канча_ва/, 13),
      mrt: col(/мрт|рентген/, 14),
      kelish: col(/[кқ]абул/, 15),
      manzil: col(/[кқ]аердан|манзил/, 16),
      ism: col(/исм/, 17),
      tel1: col(/телефон/, 18),
      tel2: col(/номер/, 19)
    };

    const lastOp = op.getLastRow();
    const bor = new Set(lastOp > 1
      ? op.getRange(2, C.ID, lastOp - 1).getValues().flat().map(String) : []);
    let raqam = lastOp > 1 ? Number(op.getRange(lastOp, C.NUM).getValue()) || lastOp - 1 : 0;

    const yangi = [];
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const id = tozala_(row[k.id]);
      if (!id || bor.has(id)) continue;
      if (row.some(v => String(v).indexOf('<test lead') === 0)) continue;
      bor.add(id);

      const plat = String(row[k.platform]).trim().toLowerCase();
      const manba = (plat === 'ig' ? 'Instagram' : plat === 'fb' ? 'Facebook' : plat || '—') +
        (row[k.adset] ? ' · ' + row[k.adset] : '');

      yangi.push([
        ++raqam,
        sana_(row[k.vaqt]),
        matn_(row[k.ism]),
        telefon_(row[k.tel2], row[k.tel1]),
        matn_(row[k.manzil]),
        matn_(row[k.shikoyat]),
        matn_(row[k.qachondan]),
        matn_(row[k.mrt]),
        matn_(row[k.kelish]),
        manba,
        'Yangi', '', '', '', '',
        id
      ]);
    }
    if (!yangi.length) return 0;

    op.getRange(lastOp + 1, 1, yangi.length, HEADERS.length).setValues(yangi);
    if (op.getMaxRows() - op.getLastRow() < 200) formatla_(op);
    return yangi.length;
  } finally {
    lock.releaseLock();
  }
}

function xomVaraq_(ss) {
  return ss.getSheets().find(s => s.getName() !== OP && s.getLastColumn() > 1 &&
    s.getRange(1, 1, 1, s.getLastColumn()).getDisplayValues()[0]
      .map(x => String(x).trim().toLowerCase()).includes('created_time'));
}

/** "l:1444..." / "p:+998..." kabi prefikslarni olib tashlaydi */
function tozala_(v) { return String(v || '').trim().replace(/^[a-z]{1,3}:/i, ''); }

/** "бўйин_оғриғи_/_бел" → "Бўйин оғриғи / бел" */
function matn_(v) {
  const s = tozala_(v).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function sana_(v) {
  const d = new Date(String(v).trim());
  return isNaN(d) ? String(v) : d;
}

/** Asosiy raqam (Meta'dan) + bemor qo'lda yozgan boshqa raqam bo'lsa, ikkalasi */
function telefon_(asosiy, qolda) {
  const a = tozala_(asosiy);
  const b = tozala_(qolda);
  const ra = a.replace(/\D/g, ''), rb = b.replace(/\D/g, '');
  if (!ra) return b;
  if (!rb || ra.indexOf(rb.slice(-9)) >= 0) return a;
  return a + ' / ' + b;
}

/* ------------------------------ Avtomatika ------------------------------ */

/** "Javob bermadi" / "Qayta bog'lanish" tanlansa — qo'ng'iroq sanasi bo'sh bo'lsa ertaga qo'yiladi */
function onEdit(e) {
  const r = e.range, sh = r.getSheet();
  if (sh.getName() !== OP || r.getRow() < 2 || r.getColumn() !== C.HOLAT || r.getNumRows() > 1) return;
  const v = r.getValue();
  const bog = sh.getRange(r.getRow(), C.BOG);
  if ((v === 'Javob bermadi' || v === "Qayta bog'lanish") && !bog.getValue()) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    bog.setValue(d);
  }
}

/* ------------------------------ Bugun ------------------------------ */

function bugunVarag_(ss) {
  let sh = ss.getSheetByName(BUGUN);
  if (sh) sh.clear(); else sh = ss.insertSheet(BUGUN, 1);
  [70, 110, 150, 175, 170, 135, 260].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('A1').setFormula('="📅 Bugun: "&TEXT(TODAY(),"dd.mm.yyyy")')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1f4e79');

  const o = OP + '!';
  const blok = (row, title, color, headers, formula) => {
    sh.getRange(row, 1, 1, 7).merge().setValue(title).setBackground(color).setFontWeight('bold').setFontSize(12);
    sh.getRange(row + 1, 1, 1, 7).setValues([headers]).setFontWeight('bold').setBackground('#eeeeee');
    sh.getRange(row + 2, 1).setFormula(formula);
  };

  blok(3, '🏥 BUGUN KELADIGAN BEMORLAR', '#c8f7c5',
    ['Soat', '№', 'Bemor ismi', 'Telefon', 'Shikoyat', 'Holat', 'Izoh'],
    '=IFERROR(SORT(FILTER({TEXT(' + o + 'N2:N,"HH:mm"),' + o + 'A2:A,' + o + 'C2:C,' + o + 'D2:D,' +
    o + 'F2:F,' + o + 'K2:K,' + o + 'O2:O},' + o + 'M2:M=TODAY(),' + o + 'C2:C<>""),1,TRUE),' +
    '"Bugun qabulga yozilgan bemor yo\'q")');

  const ochiq = YOPIQ.map(h => o + 'K2:K<>"' + h + '"').join(',');
  blok(45, "📞 BUGUN QO'NG'IROQ QILISH KERAK (muddati o'tganlar ham)", '#fff2a8',
    ['Sana', '№', 'Bemor ismi', 'Telefon', 'Shikoyat', 'Holat', 'Izoh'],
    '=IFERROR(SORT(FILTER({' + o + 'L2:L,' + o + 'A2:A,' + o + 'C2:C,' + o + 'D2:D,' +
    o + 'F2:F,' + o + 'K2:K,' + o + 'O2:O},' + o + 'L2:L<>"",' + o + 'L2:L<=TODAY(),' + ochiq + '),1,TRUE),' +
    '"Bugun qo\'ng\'iroq qilinadigan bemor yo\'q ✅")');
  sh.getRange('A47:A400').setNumberFormat('dd.mm');

  blok(90, "🔵 HALI BOG'LANILMAGAN YANGI LIDLAR", '#cfe2ff',
    ['Lid vaqti', '№', 'Bemor ismi', 'Telefon', 'Shikoyat', 'Manzil', 'Bemor: qachon kelmoqchi'],
    '=IFERROR(SORT(FILTER({' + o + 'B2:B,' + o + 'A2:A,' + o + 'C2:C,' + o + 'D2:D,' +
    o + 'F2:F,' + o + 'E2:E,' + o + 'I2:I},' + o + 'K2:K="Yangi"),1,FALSE),"Yangi lid yo\'q ✅")');
  sh.getRange('A92:A400').setNumberFormat('dd.mm HH:mm');
  sh.setFrozenRows(1);
  himoya_(sh, 'bugun', sh.getRange('A1:G400'));
}

/* ------------------------------ Statistika ------------------------------ */

function statistikaVarag_(ss) {
  let sh = ss.getSheetByName(STAT);
  if (sh) sh.clear(); else sh = ss.insertSheet(STAT, 2);
  [240, 90, 30, 200, 90].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('A1').setValue('📊 Statistika').setFontSize(16).setFontWeight('bold').setFontColor('#1f4e79');

  const o = OP + '!';
  const ochiq = YOPIQ.map(h => o + 'K2:K,"<>' + h + '"').join(',');
  const umumiy = [
    ['Jami lidlar', '=COUNTA(' + o + 'C2:C)'],
    ['Bugun kelgan lidlar', '=COUNTIFS(' + o + 'B2:B,">="&TODAY(),' + o + 'B2:B,"<"&TODAY()+1)'],
    ['Shu oy lidlar', '=COUNTIFS(' + o + 'B2:B,">="&(EOMONTH(TODAY(),-1)+1),' + o + 'B2:B,"<"&(EOMONTH(TODAY(),0)+1))'],
    ['Bugun keladigan bemorlar', '=COUNTIF(' + o + 'M2:M,TODAY())'],
    ["Bugun qo'ng'iroq kerak", '=COUNTIFS(' + o + 'L2:L,"<="&TODAY(),' + ochiq + ')'],
    ["Hali bog'lanilmagan", '=COUNTIF(' + o + 'K2:K,"Yangi")'],
    ['Konversiya (Keldi / Jami)', '=IFERROR(COUNTIF(' + o + 'K2:K,"Keldi")/B3,0)']
  ];
  sh.getRange(3, 1, umumiy.length, 2).setValues(umumiy);
  sh.getRange(3, 1, umumiy.length, 1).setFontWeight('bold');
  sh.getRange(3, 2, umumiy.length, 1).setHorizontalAlignment('center').setFontSize(12);
  sh.getRange(3 + umumiy.length - 1, 2).setNumberFormat('0%');

  const sarlavha = (a1, t) => sh.getRange(a1).setValues([[t, 'Soni']])
    .setBackground('#1f4e79').setFontColor('#ffffff').setFontWeight('bold');

  sarlavha('A12:B12', "Holat bo'yicha");
  const h = Object.keys(HOLATLAR);
  sh.getRange(13, 1, h.length, 2).setValues(h.map((x, i) =>
    [x, '=COUNTIF(' + o + 'K2:K,A' + (13 + i) + ')']));

  sarlavha('D12:E12', "Manba bo'yicha");
  sh.getRange('D13:E16').setValues([
    ['Instagram', '=COUNTIF(' + o + 'J2:J,"Instagram*")'],
    ['Facebook', '=COUNTIF(' + o + 'J2:J,"Facebook*")'],
    ['Instagram → Keldi', '=COUNTIFS(' + o + 'J2:J,"Instagram*",' + o + 'K2:K,"Keldi")'],
    ['Facebook → Keldi', '=COUNTIFS(' + o + 'J2:J,"Facebook*",' + o + 'K2:K,"Keldi")']
  ]);
  sh.getRange('B13:B30').setHorizontalAlignment('center');
  sh.getRange('E13:E30').setHorizontalAlignment('center');
  himoya_(sh, 'stat', sh.getRange('A1:E30'));
}
