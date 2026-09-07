# 台灣漫遊錄 · Taiwan Wanderings

原創 HTML5 動漫探索解謎遊戲。與旅伴小嵐從九份走到花蓮，探索 15 處場景線索、完成 5 個關卡、收集 5 枚記憶印章，讀取旅途結局。

![九份山城場景](dist/assets/jiufen.webp)

## 立即執行

需要 **Node.js 22 或更新版本**。沒有第三方套件、資料庫或建置步驟。

```bash
npm start
```

開啟 `http://127.0.0.1:3000`。也可使用 `node server.mjs`。

- 單一 Node.js 服務、單一 port，同時供應 HTML5 遊戲與 AI API。
- 滑鼠、手機觸控或 Tab / Enter 操作；Esc 關閉視窗。
- 在場景點選三個標記 → 閱讀線索 → 解謎 → 解鎖下一站。
- 旅人手帳保存線索與印章；localStorage 自動存檔。換瀏覽器、清除網站資料或換裝置不會同步進度。
- 音效預設關閉，點擊右上方「音效」可開啟。
- 這是場景點擊冒險／視覺小說，沒有即時戰鬥或角色自由走動。

## AI 自由對話

**未設定 API 時，使用明確標示的預寫離線劇情，不是生成式 AI。** 所有關卡均可在此模式通關。自由輸入可取得任務提示、角色介紹等有限回應。

啟用真正的生成式 NPC 對話：

1. 複製 `.env.example` 為 `.env`。
2. 設定 `AI_API_KEY`、`AI_MODEL`；使用你帳號中可用、支援 Chat Completions 的模型。
3. 如使用其他相容服務，設定 `AI_BASE_URL`，例如該服務的 `/v1` 端點。實作使用 `max_completion_tokens`，服務需支援此參數。
4. 重新執行 `npm start` 並重新整理遊戲。

```dotenv
AI_API_KEY=your-api-key
AI_MODEL=your-compatible-model-id
AI_BASE_URL=https://api.openai.com/v1
PORT=3000
HOST=127.0.0.1
```

金鑰只在伺服器端，`.env` 已排除於 Git。模型收到當前章節、已探索線索與最近 8 則對話。AI 回覆只顯示文字，不能修改存檔或代玩家通關。連線逾時、額度不足或供應商失敗時，介面會通知並回退離線劇情。

伺服器每分鐘最多 12 次 AI 請求、最多 2 個同時進行的請求；上游逾時 25 秒。預設只監聽本機。若部署為對外多人服務，需由部署者加入 HTTPS、使用者驗證及相應的用量管理，並調整限流策略。本版不含帳號服務。

API 格式參考：[Chat Completions 官方文件](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create/)。

## 五個關卡

| 章節 | 地點 | 任務 | 核心機制 | 印章 |
| --- | --- | --- | --- | --- |
| 01 山城裡的微光 | 九份 | 依線索點亮燈籠 | 顏色排序 | 山城燈火 |
| 02 寄往明天的信 | 台北 | 安排送信路線 | 順序推理 | 城市來信 |
| 03 湖面記得的歌 | 日月潭 | 重現湖畔回聲 | 四音符序列，可重複音符 | 湖光之歌 |
| 04 一碗人情的溫度 | 台南 | 完成回憶碗粿 | 步驟排序 | 巷弄暖味 |
| 05 把海帶回心裡 | 花蓮 | 修復海岸明信片 | 四格圖片旋轉 | 太平洋來風 |

每關三處線索全部探索後才可解謎。答錯可重試或查看提示，不扣生命、不清除進度。已完成關卡可重玩，不重複發放印章。各章與小嵐分享心情可增加共同回憶；累積至少三章會改變結局最後一句話。

故事、人物、留言、任務食譜及旋律皆為虛構；插畫為 AI 生成，不作現地導航或史實佐證。沒有引用商業動漫角色。

## 部署方式

### 自架完整版本（含 AI）

執行 `npm start`，由同一服務提供靜態檔案與 `/api/chat`。`HOST` 與 `PORT` 可以透過環境變數調整。部署時在主機設定金鑰，不要上傳 `.env`。

### 純靜態版本／GitHub Pages

發布 `dist/` 內容即可。**純靜態主機沒有 `/api/chat`，只提供離線劇情。** 此專案的 Sites 私人試玩版也是此模式。要使用真正 AI 請部署 Node.js 服務。

GitHub Pages 可用自訂部署來源指向 `dist/`，或將其內容作為網站發布目錄。專案沒有自動部署工作流程，避免在儲存程式時改變公開可見性。

瀏覽器使用 JavaScript ES modules，請透過 HTTP 開啟；不要直接雙擊 `dist/index.html` 使用 `file://`。

## 專案結構

```text
README.md              啟動、AI 與部署說明
DESIGN.md              故事設計、狀態與擴充方式
server.mjs             單一 HTTP 服務＋伺服器端 AI 代理
.env.example           環境變數範本（不含金鑰）
package.json           執行與測試指令，零套件依賴
dist/
  index.html           HTML5 遊戲介面
  style.css            桌機與手機版面
  game.js              場景、手帳、解謎、對話、音效
  engine.js            狀態驗證、通關規則、離線對話
  levels.js            五章內容與謎題資料
  assets/              原創動漫背景與小嵐角色圖
tests/                 關卡引擎及 AI HTTP 整合測試
```

## 驗證

```bash
npm run check
npm test
```

10 項自動測試涵蓋：五章循序通關、錯誤答案與線索門檻、重玩不重複獎勵、存檔損壞修復、離線提示、圖片旋轉、靜態素材、AI 請求組裝與角色保護、API 錯誤／過大輸入／跨來源拒絕、用量限制。AI 以模擬上游服務測試，沒有使用真實付費 API 金鑰做線上驗證。尚未執行瀏覽器端操作測試。

## 原始碼

Repository：[cloudaipro/taiwan-wanderings](https://github.com/cloudaipro/taiwan-wanderings)

```bash
git clone https://github.com/cloudaipro/taiwan-wanderings.git
cd taiwan-wanderings
npm start
```

需要 Node.js 22 或更新版本。AI 設定請參照上方說明。
