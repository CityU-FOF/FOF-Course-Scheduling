/* Offline workbook layouts. The bundled SheetJS writer is kept for compatibility. */
(function(root,factory){const api=factory(typeof module==='object'?require('./scheduler-core.js'):root.FOFCore);if(typeof module==='object')module.exports=api;else root.FOFExcel=api;})(typeof globalThis!=='undefined'?globalThis:this,C=>{
'use strict';
const headers=['科目編號\nCourse Code','科目名稱\nCourse Name','學分\nCredits','必/選\nCategory','班級\nClass','上課日\nDate','上課時段\nTime','課室\nVenue','上課起止日\nDuration','授課老師\nInstructor'];
const knownNames={BAE102:['線性代數導論','Introductory Linear Algebra'],BAE104:['宏觀經濟學導論','Introductory Macroeconomics'],BAE106:['會計學導論II','Introductory Accounting II']};
const compact=s=>String(s||'').replace(/\s/g,'');
function englishNameFor(code,name,entry){const known=knownNames[code];return entry?.englishName!==undefined&&compact(entry.name)===compact(name)?entry.englishName:known&&compact(known[0])===compact(name)?known[1]:'';}
const labelClass=s=>s.replace(/^大([一二三四])(?=.)/,(_,n)=>String('一二三四'.indexOf(n)+1));
function scheduleSheet(X,data,catalog){
 const byCode=new Map(catalog.map(c=>[c.code,c]));const rows=C.scheduleRows(data).map(r=>{const name=r['科目名'],en=englishNameFor(r['科目編號'],name,byCode.get(r['科目編號']));return [r['科目編號'],en?name+'\n'+en:name,r['學分'],r['必修/選修']==='選修'?'選':'必',labelClass(r['班級']),r['星期'],r['時間'],r['課室']||'金龍校區',r['上課期間'].replace(/(\d{4})\.(\d{2})\.(\d{2})/g,'$1/$2/$3'),r['授課老師']];});
 const widths=[10,25,8,8,8,8,21,13,17,16];
 const lines=(v,w)=>String(v??'').split('\n').reduce((total,line)=>total+Math.max(1,Math.ceil([...line].reduce((n,ch)=>n+(ch.codePointAt(0)>0x2e80?1.5:.72),0)/(w-1.3))),0);
 const ws=X.utils.aoa_to_sheet([headers,...rows]);ws['!cols']=widths.map(wch=>({wch}));ws['!rows']=[{hpt:34},...rows.map(r=>({hpt:Math.min(409,15*Math.max(...r.map((v,c)=>lines(v,widths[c])))+6)}))];ws['!autofilter']={ref:ws['!ref']};return ws;
}
function workloadRows(stats,annual,term){
 const semester=new Map(stats.map(s=>[s.name,s])),yearly=new Map(annual.rows.map(s=>[s.name,s]));
 return [...new Set([...semester.keys(),...yearly.keys()])].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(name=>{const s=semester.get(name),a=yearly.get(name);return {
  '教師':name,'本期學年':term.termInfo.academicYear||'未設定','學期':term.settings.semesterName,'上／下學期':term.termInfo.semester,
  '任教明細':s?.classes.join('；')??'','每週班級節次':s?.scheduled??'','每週實際課堂':s?.physical??'','待排節次':s?.pending??'',
  '補充已核定學時':s?.additionalHours??'','已排名義學時':s?.courseHours??'','已排及補充總學時':s?.numerator??'','總學時':s?.denominator??'','按班鐘點小時':s?.clockHours??'',
  '全年學年':annual.academicYear||'未設定','上學期已排':a?C.round(a.upper):'','下學期已排':a?C.round(a.lower):'','未分類學期已排':a?C.round(a.unclassified):'','全年已排':a?.scheduled??'','全年待排學時':a?.pending??'','全年預計':a?.planned??'','全年補充學時':a?C.round(a.additional):'',
  '標準目標':a?.baseTarget??'','結轉調整':a?.carryIn??'','本年目標':a?.target??'','已排距離目標':a?.remaining??'','尚可分配':a?.toAllocate??'','上年差額參考':a?a.priorBalance??'上年未完成核算':'','參考安排目標':a?a.suggestedTarget??'未提供':'','本年核算':a?(a.complete?'已確認':'規劃中'):'','備註':a?.note??'',
  '計算口徑':'按教師歸屬；含考試週；合班各班相加；另加明確計入的補充學時；假期未自動扣減'};});
}
function periodRows(distribution,load,days){
 const cells=new Map(distribution.cells.map(c=>[c.day+':'+c.slot,c]));return days.flatMap((name,d)=>C.slots.map(s=>{const c=cells.get((d+1)+':'+s.num),p=load(d+1,s.num);return {
  '星期':name,'節次':s.num,'時間':s.time,'分佈範圍':c?(distribution.scope==='all'?'含外院課':'僅本院'):'未納入分佈','分佈實際課堂':c?.sessions??'','佔全週課堂(%)':c?C.round(c.share):'','平均課堂數':c?C.round(distribution.average):'','平均倍數':c?C.round(c.multiple):'','已知學生人次':c?.people??'','分佈未填人數班次':c?.unknownPeople??'','集中程度':c?.label??'','比較時段數':c?distribution.slotCount:'','全週課堂數':c?distribution.totalSessions:'',
  '本院實際課堂':p.sessions,'本院班級節次':p.classes,'可用已登記教室':p.availableRooms,'已佔用已登記教室':p.occupiedRooms,'未填課室班次':p.missingRooms,'本院未填人數班次':p.unknownClasses,'超容量教室':p.overRooms};}));
}
// SheetJS CE omits font/fill/alignment/borders when writing. Extend only the freshly
// generated workbook's styles and schedule cells; keep the other worksheets intact.
function styledBytes(X,wb){
 const zip=X.CFB.read(new Uint8Array(X.write(wb,{bookType:'xlsx',type:'array'})),{type:'array'});
 const style=X.CFB.find(zip,'/xl/styles.xml'),sheet=X.CFB.find(zip,'/xl/worksheets/sheet'+(wb.SheetNames.indexOf('排課明細')+1)+'.xml');
 if(!style||!sheet)throw Error('找不到排課明細或格式資料');
 const decoder=new TextDecoder(),encoder=new TextEncoder();let xml=decoder.decode(style.content);
 function append(tag,nodes){const pattern=new RegExp('(<'+tag+' count=")(\\d+)(">)([\\s\\S]*?)(</'+tag+'>)');let start;xml=xml.replace(pattern,(_,a,n,b,contents,end)=>{start=Number(n);return a+(start+nodes.length)+b+contents+nodes.join('')+end;});if(start===undefined)throw Error('無法加入排課明細格式：'+tag);return start;}
 const font=bold=>'<font>'+(bold?'<b/>':'')+'<sz val="11"/><color rgb="FF111111"/><name val="PMingLiU"/></font>';
 const fonts=append('fonts',[font(true),font(false)]),fill=append('fills',['<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>']);
 const sides=['left','right','top','bottom'].map(side=>'<'+side+' style="thin"><color rgb="FF202020"/></'+side+'>').join('');const border=append('borders',['<border>'+sides+'<diagonal/></border>']);
 const xf=(fontId,fillId)=>`<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`;
 const header=append('cellXfs',[xf(fonts,fill),xf(fonts+1,0)]);
 function set(part,value){part.content=encoder.encode(value);part.size=part.content.length;}
 set(style,xml);
 set(sheet,decoder.decode(sheet.content).replace(/<c r="([A-J])(\d+)"(?: s="\d+")?/g,(_,col,row)=>`<c r="${col}${row}" s="${row==='1'?header:header+1}"`).replace('<sheetView workbookViewId="0"/>','<sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>'));
 return X.CFB.write(zip,{fileType:'zip',type:'array',compression:true});
}
function save(X,wb,download){download('FOF排課及容量假期報表.xlsx',styledBytes(X,wb),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
return {scheduleSheet,workloadRows,periodRows,styledBytes,save,englishNameFor};
});
