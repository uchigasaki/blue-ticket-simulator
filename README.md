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
- 入力があった場合は、**1週間後に参加者IDを添えてGoogleフォームの追跡アンケートURLを送付**する想定です。
- GoogleフォームURLは `data.js` の `config.followupFormUrl` に設定します。

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
2. シート名を例として `logs` にする

### 2) Apps Script 作成
1. スプレッドシートから **拡張機能 > Apps Script**
2. 以下のサンプルを貼り付け

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logs');
  const body = JSON.parse(e.postData.contents);
  sheet.appendRow([
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

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
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

---

## ローカル動作
`index.html` をブラウザで開くだけで実行できます。
