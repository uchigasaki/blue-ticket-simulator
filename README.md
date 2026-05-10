# 自転車青切符シミュレーター Web版

## 概要
このWebアプリは、
- 事前アンケート
- 場面ベースの青切符シミュレーション
- 結果表示（総合正答率・場面判断スコア・制度理解スコア・平均回答時間・診断タイプ）
- 事後アンケート
を通じて、研究目的の学習効果測定を行うプロトタイプです。

## 研究用アンケート設計
### 事前アンケート（Pre）
- 年齢（背景属性）
- 自転車利用頻度（背景属性）
- 青切符制度の既知度（事前知識）
- ルール理解自己評価（4件法）
- 知識と場面判断のギャップ認知（4件法）
- 学習ニーズ（複数選択）
- 自由記述（任意）

### 事後アンケート（Post）
- 理解向上自己評価（4件法）
- 場面判断しやすさ（4件法）
- 教材有用性（4件法）
- 行動変容意図（4件法）
- 役立った内容（複数選択）
- 自由記述（任意）

> すべての尺度設問は4件法（1–4）で、「どちらともいえない」を置かない設計です。

## 参加者IDルール
- 形式: **英字4文字 + 数字2桁**
- 例: `BIKE33`, `NEKO12`, `STAR07`
- 正規表現: `^[A-Za-z]{4}\d{2}$`

## メールアドレスと1週間後フォローアップ
- メールアドレス入力は任意です。
- 入力があった場合は、Google Apps Script 側で参加者ID・メールアドレス・選択言語・送信予定日をGoogleスプレッドシートに保存できます。
- 1週間後に、参加者IDを本文へ明記したメールでGoogleフォームの追跡アンケートURLを送る想定です。
- 現在の追跡アンケートURLは `data.js` の `config.followupForms` に設定しています。
  - 日本語: `https://docs.google.com/forms/d/1w0KiLON2Iwh16YWDO0rxAsehIfFQLbGce85FYl2pvHs/viewform?hl=ja`
  - 英語: `https://docs.google.com/forms/d/e/1FAIpQLSdPUqYnljAeVxKN7eil14GnpuS6pmv5UNCWB1zEhq4ho2Jakw/viewform`
- `config.followupDeliveryMode` は初期値 `language` です。
  - `language`: 日本語UIの参加者には日本語フォーム、英語UIの参加者には英語フォームを送ります。
  - `both`: 両方のフォームURLを送り、どちらか一方に回答してもらう運用にできます。

---

## GitHub Pages 公開方法
1. このリポジトリを GitHub に push
2. GitHub の **Settings > Pages** を開く
3. **Build and deployment** で以下を設定
   - Source: `Deploy from a branch`
   - Branch: `main`（または公開したいブランチ）
   - Folder: `/ (root)`
4. 保存後、数分待つ
5. 表示される公開URLにアクセスして動作確認

静的ファイル構成なのでビルド不要で公開できます。

---

## Google スプレッドシート連携（Google Apps Script）

### 1) スプレッドシート準備
1. 新規Googleスプレッドシートを作成
2. `logs` と `followup_queue` の2つのシートを作成
3. `followup_queue` には、少なくとも以下の列を用意
   - `created_at`
   - `send_at`
   - `sent_at`
   - `session_id`
   - `participant_id`
   - `email`
   - `language`
   - `delivery_mode`
   - `forms_json`
   - `subject`
   - `body`

### 2) Apps Script 作成
1. スプレッドシートから **拡張機能 > Apps Script**
2. 以下のサンプルを貼り付け

```javascript
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logs = ss.getSheetByName('logs');
  const queue = ss.getSheetByName('followup_queue');
  const body = JSON.parse(e.postData.contents);

  logs.appendRow([
    new Date(),
    body.session_id,
    body.participant_id,
    body.email || '',
    body.language,
    JSON.stringify(body.summary),
    JSON.stringify(body.pre_survey),
    JSON.stringify(body.post_survey),
    JSON.stringify(body.answers)
  ]);

  if (body.email && body.followup && body.followup.email_preview) {
    queue.appendRow([
      new Date(),
      body.followup.send_at,
      '',
      body.session_id,
      body.participant_id,
      body.email,
      body.language,
      body.followup.delivery_mode,
      JSON.stringify(body.followup.email_preview.forms),
      body.followup.email_preview.subject,
      body.followup.email_preview.body
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendDueFollowups() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('followup_queue');
  const values = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const sendAt = new Date(row[1]);
    const sentAt = row[2];
    const email = row[5];
    const subject = row[9];
    const body = row[10];

    if (!sentAt && email && sendAt <= now) {
      MailApp.sendEmail(email, subject, body);
      sheet.getRange(i + 1, 3).setValue(new Date());
    }
  }
}
```

### 3) Webアプリとしてデプロイ
1. **デプロイ > 新しいデプロイ**
2. 種類: **ウェブアプリ**
3. 実行ユーザー: 自分
4. アクセス権: 必要な範囲（研究運用に合わせて設定）
5. 発行されたURLを控える

### 4) フロント側設定
- `data.js` の `config.logEndpoint` にWebアプリURLを設定
- `config.logEndpoint` が空文字のときは、ログ送信を行わずCSVダウンロードのみ動作

### 5) 1週間後メール送信用トリガー
1. Apps Script の **トリガー** を開く
2. `sendDueFollowups` を時間主導型トリガーで1日1回などに設定
3. `followup_queue` の `send_at` を過ぎた未送信行だけが送信され、送信後に `sent_at` が記録されます。

---

## ローカル動作
`index.html` をブラウザで開くだけで実行できます。
