// ===== 設定 =====
const KEYWORD = '英会話';
const MINUTES_BEFORE = 1;

// IFTTTの設定
// スクリプトプロパティ「IFTTT_KEY」にWebhookキーを設定してください
const IFTTT_EVENT_NAME = 'english_lesson_alarm';

// ===== セットアップ（初回のみ実行） =====

function setup() {
  // 既存のカレンダートリガーを削除してから再設定
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onCalendarEventUpdated')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('onCalendarEventUpdated')
    .forUserCalendar(Session.getActiveUser().getEmail())
    .onEventUpdated()
    .create();

  // 初回sync tokenを取得
  _initSyncToken();

  Logger.log('セットアップ完了。');
  Logger.log('【確認】プロジェクトの設定 → スクリプトプロパティ に「IFTTT_KEY」が設定されているか確認してください。');
}

function _initSyncToken() {
  const now = new Date();
  let pageToken;
  let syncToken;
  do {
    const params = { timeMin: now.toISOString(), singleEvents: true, maxResults: 250 };
    if (pageToken) params.pageToken = pageToken;
    const response = Calendar.Events.list('primary', params);
    pageToken = response.nextPageToken;
    syncToken = response.nextSyncToken;
  } while (pageToken);
  PropertiesService.getUserProperties().setProperty('syncToken', syncToken);
}

// ===== カレンダー変更検知 =====

function onCalendarEventUpdated() {
  syncAndCheck();
}

function syncAndCheck() {
  const props = PropertiesService.getUserProperties();
  const syncToken = props.getProperty('syncToken');

  if (!syncToken) {
    Logger.log('syncTokenが見つかりません。setup()を実行してください。');
    return;
  }

  let response;
  try {
    response = Calendar.Events.list('primary', { syncToken });
  } catch (e) {
    if (e.message && e.message.includes('410')) {
      _initSyncToken();
      return;
    }
    throw e;
  }

  props.setProperty('syncToken', response.nextSyncToken);

  const now = new Date();
  (response.items || []).forEach(event => {
    if (event.status === 'cancelled') return;
    if (!event.summary || !event.summary.includes(KEYWORD)) return;

    const startTime = event.start.dateTime
      ? new Date(event.start.dateTime)
      : new Date(event.start.date);

    if (startTime <= now) return;

    scheduleAlarm(event.id, event.summary, startTime);
  });
}

// ===== アラームのスケジューリング =====

function scheduleAlarm(eventId, title, startTime) {
  const props = PropertiesService.getUserProperties();

  if (props.getProperty('alarm_' + eventId)) return;

  const alarmTime = new Date(startTime.getTime() - MINUTES_BEFORE * 60 * 1000);
  const now = new Date();
  if (alarmTime <= now) return;

  props.setProperty('alarm_' + eventId, JSON.stringify({
    title: title,
    startTime: startTime.toISOString(),
  }));

  const trigger = ScriptApp.newTrigger('sendAlarm')
    .timeBased()
    .at(alarmTime)
    .create();

  props.setProperty('trigger_' + trigger.getUniqueId(), eventId);

  Logger.log('アラーム設定: "' + title + '" → ' + alarmTime.toLocaleString('ja-JP'));
}

// ===== IFTTT Webhook送信 =====

// time-based triggerから呼ばれる
function sendAlarm(e) {
  const triggerId = e.triggerUid;
  const props = PropertiesService.getUserProperties();

  const eventId = props.getProperty('trigger_' + triggerId);
  const eventDataJson = eventId ? props.getProperty('alarm_' + eventId) : null;
  const eventData = eventDataJson ? JSON.parse(eventDataJson) : {};
  const title = eventData.title || KEYWORD;

  const iftttKey = PropertiesService.getScriptProperties().getProperty('IFTTT_KEY');
  if (!iftttKey) {
    Logger.log('IFTTT_KEYが設定されていません。スクリプトプロパティに追加してください。');
    _cleanup(triggerId, eventId, props);
    return;
  }

  const message = title + 'の時間です！';
  const url = 'https://maker.ifttt.com/trigger/' + IFTTT_EVENT_NAME + '/with/key/' + iftttKey;

  const resp = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload: JSON.stringify({ value1: message }),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  Logger.log('IFTTT Webhook: HTTP ' + code + ' → ' + resp.getContentText());

  if (code === 200) {
    Logger.log('アナウンス送信成功: ' + message);
  } else {
    Logger.log('アナウンス送信失敗。IFTTT_KEYとIFTTTアプレット設定を確認してください。');
  }

  _cleanup(triggerId, eventId, props);
}

function _cleanup(triggerId, eventId, props) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getUniqueId() === triggerId)
    .forEach(t => ScriptApp.deleteTrigger(t));
  props.deleteProperty('trigger_' + triggerId);
  if (eventId) props.deleteProperty('alarm_' + eventId);
}

// ===== デバッグ用 =====

function listScheduledAlarms() {
  const props = PropertiesService.getUserProperties().getProperties();
  const alarms = Object.entries(props).filter(([k]) => k.startsWith('alarm_'));
  if (alarms.length === 0) {
    Logger.log('予約済みアラームはありません。');
    return;
  }
  alarms.forEach(([key, val]) => {
    const data = JSON.parse(val);
    Logger.log(key + ': ' + data.title + ' (' + new Date(data.startTime).toLocaleString('ja-JP') + ')');
  });
}

// 動作テスト: 2分後にAlexaが「英会話テストの時間です！」とアナウンス
function testAlarm() {
  const startTime = new Date(Date.now() + 2 * 60 * 1000 + MINUTES_BEFORE * 60 * 1000);
  scheduleAlarm('test_event_' + Date.now(), '英会話テスト', startTime);
  Logger.log('テストアラームを ' + new Date(Date.now() + 2 * 60 * 1000).toLocaleString('ja-JP') + ' にセットしました。');
}
