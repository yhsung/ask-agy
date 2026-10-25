# AGY Advisor

讓 OMP 主代理按需呼叫 `ask-agy`，透過本機 `agy` CLI 向 `gemini-4-argon-high` 取得技術規劃的第二意見。不啟用 OMP 原生、每輪旁聽的 advisor，也不切換主模型。

## 使用

前置條件：`omp`、Bun 與已登入的 `agy` 可從 PATH 執行；`agy models` 包含 `gemini-4-argon-high`。本專案已在 OMP 18.12.1、Bun 1.3.13 驗證。

在本專案目錄啟動新的 OMP 工作階段：

```sh
omp
```

OMP 的專案探索會載入 `.omp/extensions/ask-agy.ts`。既有工作階段不會因新增檔案而自動取得工具，需重新啟動。未修改使用者全域設定。

其他專案可明確載入此 extension；agy 的工作目錄會跟隨呼叫端的 `ctx.cwd`：

```sh
omp -e /Volumes/Samsung970EVOPlus/dev-projects/ask-agy/.omp/extensions/ask-agy.ts
```

提供兩個入口：

| 入口 | 使用方式 |
| --- | --- |
| `/ask-agy <問題>` | 使用者在互動式 OMP 輸入；主代理先整理證據，再呼叫顧問工具並核實回覆 |
| `ask-agy` | 模型可呼叫的工具；輸入欄位見下方契約 |

例如輸入 `/ask-agy 目前資料庫遷移方案有哪些風險？`，或對主代理說：「先整理證據，再用 ask-agy 評估這個方案的主要風險。」

Slash command 未帶問題時只顯示用法，不啟動詢問。工具亦會提示主代理，在重要取捨、高風險決策、證據矛盾或反覆卡住時按需使用；沒有每輪自動觸發的 hook。

在目前驗證的 OMP 18.12.1 中，print 模式不會等待 slash command 所啟動的後續回覆。因此 `/ask-agy` 請在互動模式使用；print 模式請傳入一般文字，要求主代理呼叫 `ask-agy` 工具。

## 詢問契約

| 欄位 | 內容 |
| --- | --- |
| `question` | 必填；具體問題或需要做的決策 |
| `context` | 必填；目標、限制、原始證據、已嘗試方法與未知 |
| `proposal` | 選填；目前方案、替代方案與取捨 |

每次呼叫都建立獨立 agy 對話，不使用 `--continue` 或重用歷史。呼叫端不會自動附上主代理的完整對話或讀取專案檔案。agy 仍會載入它自己的環境與專案指引，並非隔離的空白環境。

顧問被要求以正體中文回答「結論、證據與假設、主要風險、建議下一步」。回覆是普通工具結果，不是可信的系統指令或核准。主代理需核實建議，並自行負責決策及執行。

## 執行與限制

- 固定透過 `agy --mode plan --model gemini-4-argon-high`，使用 JSON 輸出並停用 slash command／skill 展開。
- 提示顧問不得呼叫工具、讀寫檔案、執行命令或委派工作。**這是 plan 模式加提示約束，不是作業系統強制的唯讀沙箱。** 不會使用跳過權限確認的旗標。
- 不自動重試，也不自動改用其他模型。CLI 啟動／執行失敗、非成功狀態、無效 JSON 或空白回答都會回報錯誤。
- agy 的 print timeout 為 120 秒；子程序另有 180 秒上限、4 MiB 輸出上限，並接收 OMP 的取消訊號。強制終止直接的 CLI 子程序，不保證回收 CLI 自行啟動的所有後代程序。
- 成功結果的 `details` 保留模型 ID 與 agy conversation ID，方便追查。agy 可能自行保留對話記錄。
- 啟動與結束事件會寫入 OMP debug log，包含 `agy` 命令、除 prompt 外的 CLI 參數、工具呼叫 ID、結束碼或錯誤碼與耗時。完整 prompt 不寫入 log；prompt 參數以字元數標示。預設 log 位置為 `~/.omp/logs/`。
- 問題會傳給 agy 的上游服務。只提供必要且已移除敏感資訊的內容；此 extension 不實作祕密自動遮蔽。

## 驗證

```sh
bun test
```

契約測試涵蓋回答解析、失敗狀態、CLI 參數稽核資料與 prompt 遮蔽。互動式 OMP 路徑曾另行驗證；目前自動化測試不會呼叫真實 agy CLI。

## 檔案

- `.omp/extensions/ask-agy.ts`：Slash command、工具註冊、輸入契約與使用時機。
- `src/advisor.ts`：顧問提示、CLI 子程序管理與輸出解析。
- `tests/advisor.test.ts`：輸出契約及 CLI log/redaction 測試。
