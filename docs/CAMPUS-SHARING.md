# Share Drive / OneDrive 算不算校內？

更新：2026-10-21。用戶已確認：Share Drive是學院網絡磁碟機，僅學院行政人員有權限查看、使用及進入。可以作學院受權限保護的程式分發及備份共用位置。伺服器實體位置、備份／複本去向及可否運行應用服務，仍未確認；存取權限與資料實體位置是不同問題。

| 你看到的服務 | 可能情況 | 是否資料留在校內 |
| --- | --- | --- |
| `S:\`、`Z:\` 或 `\\server\department` 的Share Drive | 校內Windows檔案伺服器／NAS以SMB提供共用資料夾，也可能映射外部服務 | 若IT確認伺服器、備份及複本均在校內，通常可符合；只憑磁碟機代號不能確定 |
| 學校帳戶OneDrive、Microsoft 365或SharePoint Online | 微軟雲端租戶，檔案可同步至電腦 | 學校管理權限不等於資料實體在校內；本機有副本也不等於沒有雲端副本 |
| 學校自行架設SharePoint Server / OneDrive | 校內SharePoint及SQL Server內容資料庫，也可能有混合雲設定 | 必須由IT確認內容、備份及混合設定；有純校內部署的可能 |

Microsoft官方說明分開了Microsoft 365和SharePoint Server on-premises。OneDrive這個名稱本身不足以判斷存放地點：
https://learn.microsoft.com/en-us/sharepoint/sites/onedrive-for-business-overview

## 現在可以用Share Drive做甚麼

v4仍是離線網頁，以本機IndexedDB（支援時）或瀏覽器儲存保留多學期資料。程式檔可放校內Share Drive分發，JSON備份也可存放在IT確認的校內Share Drive。網頁的工作資料仍在各自瀏覽器；**直接打開同一份HTML，不會自動讀寫同一課表。**

多人暫時協作時，指定一位主編排者，將帶日期版本的JSON作主檔，其他人查看或提供建議，再由主編排者整理。不要多人同時覆寫同名JSON；OneDrive同步也不能為排課網頁提供資料庫交易、版本衝突檢查或教師撞堂鎖定。

程式不會直接寫入Share Drive，也沒有連接Microsoft服務。下載備份時請選擇IT批准的校內位置；若「下載」「桌面」受OneDrive同步，該檔案可能同步至雲端。

## 若要校內多人看見對方修改

推薦架構：同事瀏覽器 → 校內HTTP/HTTPS應用伺服器 → 本機磁碟上的SQLite或由IT管理的校內資料庫。

- IT提供一部持續開機的校內主機或虛擬機；網頁及資料API都在校內。
- SQLite資料檔放**應用伺服器本機磁碟**；不要把運作中的SQLite檔放Share Drive／OneDrive供多部電腦直接開啟。
- Share Drive作備份目的地；使用一致性快照／備份程序，不直接同步正在寫入的資料檔。
- 同事經瀏覽器登入；資料庫在同一交易檢查版本、教師／班級／教室及限制後才接受修改。
- 加入操作者、修改時間、版本歷史、讀寫權限及恢復程序；再用即時通知或短週期刷新顯示別人更新。
- 這樣可以不另買雲端訂閱，但主機、網絡和IT維護仍需現有資源。跨校區或校外通常要校內網絡／學校VPN。

SQLite官方亦建議避免跨網絡檔案系統直接共用運作中資料庫：
https://www.sqlite.org/useovernet.html

## 現在向IT確認的三件事（行政人員權限已確認）

1. 現有學院網絡磁碟機的伺服器、備份及同步複本是否全部在校內？（毋須再確認誰有權限進入。）
2. OneDrive是Microsoft 365雲端，還是自行架設SharePoint Server？有沒有混合或雲端備份？
3. 可否提供校內主機／VM及內網網址，放一個只有學院同事登入的排課網頁和資料庫？

暫時毋須提供密碼或公開內網地址。此版本沒有建立上述伺服器，不能視為已完成校內多人同步。
