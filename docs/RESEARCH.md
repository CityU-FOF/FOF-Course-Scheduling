> v3更新（2026-10-21）：以下為v2研究紀錄。現行版已加入教師／全院／課程／班級／教室禁排限制、容量及假期撞課；教學時數按用戶確認改為合班各班相加。文中v2合班去重、Tailwind及舊待辦只屬歷史描述，現行功能以README為準。資料須留校內，後續優先採校內服務，不再以外部雲端為預設。

# 開源排課及免費共享研究

查閱日期：2026-10-20。已閱讀附件程式、GitHub專案說明及官方文件；沒有安裝、跑過或效能測試所有候選系統。下列適合度是按目前學院手動排課工作流程的判斷。

## 結論

目前保留FOF介面再改良最符合快速手動編排、時段監控及學院教學時數報表。成熟系統可提供較完整限制及自動求解，但不是即貼入HTML即可取代；部署及資料轉換也是成本。不要因「開源免費」而假設毋須伺服器或維護。

| 系統 | 已核實能力 | 對你較方便之處 | 成本／差距 | 建議 |
| --- | --- | --- | --- | --- |
| [UniTime](https://github.com/UniTime/unitime) | 大學排課、考試、教室活動及學生選課；多院系管理員協調 | 最接近將來課表＋考試＋場地系統整合目標 | 安裝、資料庫、帳戶及資料轉換較多；FOF專用時數報表仍需對接／客製 | 全校／跨學院整合時評估；現在不直接換 |
| [FET官方](https://lalescu.ro/liviu/fet/) | 免費開源桌面排課、自動／半自動／手動分配；大量教師、學生及空間限制；CSV匯入匯出 | 如果核心困難變成「大量限制下自動排課」，很值得試 | 操作及資料模型不同；不是FOF現有網頁拖曳及報表的直接替代 | 可用虛構課程做小型試排 |
| [Timefold School Timetabling](https://github.com/TimefoldAI/timefold-quickstarts/tree/stable/use-cases/school-timetabling) | 課室、教師、學生組別硬性衝突；房間穩定、教師空堂及科目多樣性軟性限制；Solve示例 | 日後保留FOF介面、背後加入自動建議的參考 | Java／Maven或Gradle；是開發起點，非即裝即用的學院行政成品。使用Community Edition；另有付費版本 | 優先借鑑限制設計，日後再接求解器 |
| FOF v2.0（本倉庫） | 四種檢視、拖曳／點選排課、衝突、合班、課室欄位、統計及匯出 | 繁中、延續你原有工作方法，打開便用 | 尚無自動求解、多用戶、單雙週、容量、教師不可用時段 | 現階段優先使用及以真實規則驗收 |

GitHub 搜尋亦出現多個FET鏡像／工具，不應直接當成官方最新版本；下載以官方FET網站為準。未以星數或單次更新日期代替功能審核。

## 現有程式的重要問題

1. `availableClassesInPool`實際回傳班級字串陣列，PDF彈窗及全選卻將它當成「課程→年級→班級」物件，故批次列印可能出錯；已改為獨立完整班級樹。
2. 教師時數以任教班級數×45，再按已排拼圖比例計算，可能掩蓋課節數不同及合班問題；已改為分鐘公式並清楚標示推算範圍。
3. 原版只找一筆同時段教師排課；缺乏完整班級及課室檢查；新版逐項檢查，舊備份另可全院掃描。
4. 3%密度只反映佔比：全院已排量改變會令同一格的警告顏色改變，不等於教室或教師資源超載；已改為自訂課堂數提示線。此線仍不代表實際教室容量。
5. 原版外部CDN在斷網時可能無法啟動。新版附帶Vue、SheetJS及已編譯CSS。
6. Excel教師明細只固定六欄；新版完整文字欄不截斷，另輸出待排、時段負荷及設定表。

## 不用錢可以多人共享嗎？

**可以，但仍需要共享資料層。只將HTML放GitHub Pages，大家打開同一網址，也不會共享localStorage。** GitHub Pages官方定義為靜態網站託管。

| 方案 | 額外服務費 | 看見對方修改 | 必要條件／限制 | 適合度 |
| --- | --- | --- | --- | --- |
| 傳送JSON／共用資料夾存JSON | 可為0，視既有資源 | 需手動匯入 | 指定一人整理主檔；檔案放共用資料夾不會自動令網頁同步，直接多人覆寫會互蓋 | 現階段臨時方式 |
| 學院現有電腦作內聯網伺服器＋SQLite | 可無新增訂閱費 | 可做即時／定時刷新 | 電腦持續開機、網絡可達、IT允許；要開發登入、權限、資料交易及備份；校外存取另處理 | 如果不能把內部課表放外部雲，優先研究 |
| GitHub Pages＋Supabase Free | 免費配額內為0 | 可以加入Realtime | 要建立服務及登入、行級權限（RLS）、資料版本檢查；免費服務有配額及休眠，政策可變 | 小型同事協作試點較方便 |
| 自行部署UniTime | 軟件免費，主機／維護另計 | 支援多人協調 | 管理員、伺服器及資料轉換 | 長期整合時考慮 |

### 我會怎樣設計Supabase試點

- 程式放GitHub Pages；課表資料放受權限保護的資料庫，**不放公開GitHub資料檔**。
- 只准受邀同事登入；按學院／學期授權讀寫，禁止匿名寫入。
- 每項修改送出原版本號；資料庫在同一交易驗證版本及衝突，舊版本被拒絕並提示重新載入。
- Realtime只負責通知其他視窗更新，不能代替交易及撞堂檢查。
- 每筆修改保留操作者及時間；管理者可匯出JSON備份。
- 前端只可放publishable／anon key；絕不放service-role金鑰或GitHub寫入token。
- 先確認學院能否使用外部雲端及需要哪些登入方式，再接真實資料。

查閱時Supabase Free：500MB資料庫、每月200萬Realtime訊息、200個Realtime尖峰連線；一週沒有活動會暫停，最多兩個活躍免費專案。這些是配額及服務條款，並非永久免費或不中斷的承諾；小組是否足夠仍要按實際用量評估。

本版**尚未接上**任何線上資料庫、帳戶或即時同步；不能將它描述為已完成多人版。

## 官方來源

- UniTime專案：https://github.com/UniTime/unitime
- UniTime官方介紹及多部門協作：https://www.unitime.org/
- UniTime安裝：https://help.unitime.org/installation
- FET功能與限制：https://lalescu.ro/liviu/fet/features.html
- Timefold排課範例及硬／軟限制：https://github.com/TimefoldAI/timefold-quickstarts/blob/stable/use-cases/school-timetabling/README.md
- Timefold quickstarts定位：https://github.com/TimefoldAI/timefold-quickstarts
- GitHub Pages定義：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Supabase免費配額及休眠：https://supabase.com/pricing
- Supabase Realtime配額：https://supabase.com/docs/guides/realtime/pricing
