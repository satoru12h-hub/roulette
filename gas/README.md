# Google Calendar → Alexa 英会話アラーム

Googleカレンダーに「英会話」を含むイベントを追加すると、開始1分前にAlexaが自動でアナウンスします。

## 仕組み

```
Googleカレンダーに「英会話」イベント追加
    ↓ onEventUpdated trigger（GAS）
GAS: sync tokenで変更検知・新規イベントを識別
    ↓ 1分前のtime-based triggerを動的作成
GAS: IFTTT Maker Webhook（POST）
    ↓
IFTTT: Alexaアクション「英会話の時間です！」とアナウンス
```

**IFTTTを経由する理由**: AlexaにアラームをセットするパブリックAPIはGASから直接利用できないため、IFTTT Maker Webhooksをブリッジとして使います。GASからPOSTで直接呼び出すため、即時実行されます。

## セットアップ手順

### 1. IFTTTの設定（約5分）

1. [https://ifttt.com](https://ifttt.com) でアカウントを作成またはログイン
2. **Create** → 新しいアプレットを作成
3. **If This** → 「Webhooks」を選択 → **Receive a web request**
   - Event Name: `english_lesson_alarm`
4. **Then That** → 「Amazon Alexa」を選択 → **Make an announcement**
   - Message: `{{Value1}}`
5. アプレットを保存して有効化
6. [https://ifttt.com/maker_webhooks](https://ifttt.com/maker_webhooks) → **Documentation** → **Webhookキー**をメモ

### 2. GASの設定（約5分）

1. [https://script.google.com](https://script.google.com) で新しいプロジェクトを作成
2. プロジェクト名を適当に設定（例：「英会話アラーム」）

#### マニフェストの更新

1. 左側の歯車アイコン（プロジェクトの設定）→ **「appsscript.json」マニフェストファイルをエディタで表示する** にチェック
2. エディタで `appsscript.json` を選択し、このリポジトリの `gas/appsscript.json` の内容で上書きして保存

#### スクリプトの貼り付け

1. エディタで `コード.gs`（または `Code.gs`）を選択
2. このリポジトリの `gas/Code.gs` の内容で上書きして保存

#### スクリプトプロパティの設定

1. 左側の歯車アイコン（プロジェクトの設定）→ **スクリプトプロパティ**
2. **プロパティを追加** → キー: `IFTTT_KEY`、値: 手順1でメモしたWebhookキー
3. **スクリプトプロパティを保存**

#### セットアップ関数を実行

1. エディタで `setup` 関数を選択して **▶ 実行**
2. アクセス許可を求められたら全て承認する
3. 実行ログに「セットアップ完了」と表示されることを確認

---

## 動作確認

1. GASエディタで `testAlarm` 関数を実行
2. 2分後にAlexaが「英会話テストの時間です！」とアナウンスすることを確認

または、Googleカレンダーに「英会話テスト」というイベントを数分後に作成し、1分前にAlexaがアナウンスすることを確認します。

---

## 注意事項

- GASのtime-basedトリガーは±数分の誤差があります。「1分前」は厳密ではなく0〜3分前程度になることがあります
- Alexaデバイスがオンライン状態でないとアナウンスは再生されません
- IFTTTのAlexaアクションは、Alexa連携済みのデバイスにアナウンスします
- IFTTT無料プランで動作します（Maker Webhooksは無料枠内）

## カスタマイズ

`Code.gs` の先頭の設定値を変更できます：

```javascript
const KEYWORD = '英会話';       // 検知するキーワード
const MINUTES_BEFORE = 1;       // 何分前に通知するか
const IFTTT_EVENT_NAME = 'english_lesson_alarm';  // IFTTTイベント名
```
