/** ТИХО: анонимные планы самовывоза. Таблица остаётся закрытой. */
const SHEET_ID_ = '19fZ-bLDrnJ99Fl0NCMYmGoCMpF5bYbEvqN2iUJxIQvA';
const ZONE_ = 'Europe/Moscow';
const PRICE_ = 300;

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Form')
    .setTitle('ТИХО — планирую забрать')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPlanDays() {
  const today = Utilities.formatDate(new Date(), ZONE_, 'yyyy-MM-dd');
  const tomorrow = new Date(today + 'T12:00:00+03:00');
  tomorrow.setTime(tomorrow.getTime() + 86400000);
  return [today, Utilities.formatDate(tomorrow, ZONE_, 'yyyy-MM-dd')];
}

function submitPlan(input) {
  if (!input || typeof input !== 'object' || input.website) throw new Error('Не удалось принять заявку.');
  const id = input.id;
  const day = input.day;
  const count = input.quantity;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) || !getPlanDays().includes(day)
      || !Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Выберите сегодня или завтра и количество от 1 до 20 коробок.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Сейчас много заявок. Попробуйте ещё раз через минуту.');
  try {
    const book = SpreadsheetApp.openById(SHEET_ID_);
    const sheet = book.getSheetByName('Заявки');
    if (!sheet) throw new Error('Таблица ещё не настроена.');
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues() : [];
    const found = rows.findIndex(row => row[4] === id);
    if (found >= 0 && String(rows[found][1]) !== day) throw new Error('Обновите страницу и выберите день заново.');
    const row = found >= 0 ? found + 2 : sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 2).setNumberFormat('@');
    sheet.getRange(row, 1, 1, 5).setValues([[
      Utilities.formatDate(new Date(), ZONE_, 'yyyy-MM-dd HH:mm:ss'), day, count, count * PRICE_, id
    ]]);
    // Повтор с тем же ID обновляет строку, а не создаёт вторую заявку.
    refreshSummary_(book);
    SpreadsheetApp.flush();
    return {saved: true, day: day, quantity: count, updated: found >= 0};
  } finally { lock.releaseLock(); }
}

function refreshSummary_(book) {
  const summary = book.getSheetByName('Сводка');
  const plans = book.getSheetByName('Заявки');
  const days = getPlanDays();
  const rows = plans.getLastRow() > 1 ? plans.getRange(2, 2, plans.getLastRow() - 1, 2).getValues() : [];
  const results = days.map((day, i) => {
    const chosen = rows.filter(row => String(row[0]) === day);
    return [(i === 0 ? 'Сегодня · ' : 'Завтра · ') + day,
      chosen.reduce((sum, row) => sum + Number(row[1] || 0), 0), chosen.length];
  });
  summary.getRange('A4:C5').setValues(results);
  summary.getRange('A7').setValue('Обновлено: ' + Utilities.formatDate(new Date(), ZONE_, 'dd.MM.yyyy HH:mm'));
  summary.getRange('A9').setValue('В итогах планы покупателей, без брони и оплаты. Подключение формы проверяется отдельно.');
}

/** Запустить вручную в редакторе один раз до публикации. */
function initializeTiho() {
  const owner = Session.getEffectiveUser().getEmail();
  if (!owner || Session.getActiveUser().getEmail() !== owner) throw new Error('Настройка доступна только владельцу скрипта.');
  const book = SpreadsheetApp.openById(SHEET_ID_);
  book.setSpreadsheetTimeZone(ZONE_);
  book.setSpreadsheetLocale('ru_RU');
  refreshSummary_(book);
  const exists = ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'refreshDaily_');
  if (!exists) ScriptApp.newTrigger('refreshDaily_').timeBased().everyHours(1).create();
}
function refreshDaily_() { refreshSummary_(SpreadsheetApp.openById(SHEET_ID_)); }
function onOpen() { refreshDaily_(); }
