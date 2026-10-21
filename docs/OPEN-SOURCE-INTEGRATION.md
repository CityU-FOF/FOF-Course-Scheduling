# v3.2 開源程式碼整合紀錄

查閱／整合：2026-10-21。此文件區分實際執行的第三方程式碼與設計參考。

| 來源 | 本次實際採用 | 接入位置 | 授權／限制 |
| --- | --- | --- | --- |
| [taye/interact.js](https://github.com/taye/interact.js) | 未修改的1.10.28瀏覽器程式庫，真正執行滑鼠／觸控拖曳事件 | vendor/interact.min.js、pointer-dnd.js及app.js mounted鉤子 | MIT；完整授權隨附；沒有用付費Interact Pro |
| [mholt/PapaParse](https://github.com/mholt/PapaParse) | 未修改的5.7.0程式庫，真正解析匯入CSV | vendor/papaparse.min.js、app.js importHolidays、核心CSV轉換器的parser參數 | MIT；完整授權隨附；只解析使用者選定的本機字串，沒有啟用遠端下載或worker |
| [Timefold排課範例](https://github.com/TimefoldAI/timefold-quickstarts/blob/stable/use-cases/school-timetabling/README.md) | 硬性衝突／教師時間效率等規則作設計參考；FOF自行寫候選排序 | scheduler-core.js suggestions | 不是搬入Java程式碼，也不是Timefold Solver；無全局最優保證 |

## 為何採用元件，而非整套搬入

UniTime／FET／Timefold各有伺服器或桌面／Java資料模型，不能直接當成FOF離線HTML的功能模組。這一輪採用能直接離線執行的元件，保留學院已確認的資料模型、合班學時計算、日期範圍及校內儲存要求。

## 拖曳整合

- interact.js處理pointer事件。FOF只移動視覺分身，不讓第三方搬動Vue擁有的原課節節點。
- 放入時間格或待排池後，仍走FOF同一個place／returnPool入口；不繞過教師、班級、課室、鎖定、禁排與已知容量限制。
- 放到工作台以外取消；Escape可取消。原生HTML拖曳作程式庫不可用時的備用，點選排課仍保留。
- 捲動到課表左右邊緣可橫向移動。觸控需在真實設備試用；模擬DOM測試不能替代手指操作驗收。

## 候選排序

- 掃描每週56個時段（預設只顯示平日候選），以目前硬性限制排除不可行安排。
- 「平均時段負荷」主要降低同一時段課堂量；「減少教師空堂」主要降低教師新增授課日及節次空格；同科目同班同日重複亦有偏好成本。
- 只提供前8個候選，固定次序可重現；沒有窮舉多課程組合或自動重排其他課節。
- 建議呈現時不修改資料；真正點選後重新檢查。若需要合班，另行確認。容量資料未齊會提示核實。
- 週末勾選只影響候選，不會改變學院每週禁排規則或手動排課權限。

## CSV整合

Papa Parse支援逗號、分號、tab等分隔符的識別、BOM、引號及欄內換行。轉換後仍須通過FOF的欄位、日期範圍、時間及備份資料驗證。欄名重複、欄數不符或格式錯誤整份拒絕，不作部分匯入。

## 可重現來源

- https://unpkg.com/interactjs@1.10.28/dist/interact.min.js
- https://github.com/taye/interact.js/blob/v1.10.28/LICENSE
- https://interactjs.io/docs/draggable/
- https://interactjs.io/docs/action-options/
- https://unpkg.com/papaparse@5.7.0/papaparse.min.js
- https://unpkg.com/papaparse@5.7.0/LICENSE
- https://www.papaparse.com/docs

執行期不向這些網址讀取任何檔案或傳送課表資料。公開倉庫只有程式、授權、用戶提供的品牌圖及虛構驗證樣本。
