const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../scheduler-core.js'),E=require('../excel-export.js'),X=require('../vendor/xlsx.full.min.js');
const program=C.programmes[0].name;
const block=(id,extra={})=>({id,program,grade:'大一',className:'A',subjectCode:'BAE102',subject:'線性代數導論',teacher:'示例教師',assessment:'閉卷考試',room:'',headcount:20,...extra});
const item=(id,day,slot,extra)=>({day,slot,block:block(id,extra)});
const termInfo=(id,semester)=>({id,academicYear:'2026/2027',semester,finalized:false});
const state=extra=>C.validate({timetable:[],unassignedBlocks:[],...extra});
const sheetRows=ws=>X.utils.sheet_to_json(ws,{header:1,defval:''});

test('schedule export follows the bilingual reference, keeps actual rooms/teachers and uses campus fallback only in the workbook',()=>{
 const d=state({settings:{...C.defaults,startDate:'2027-01-04',endDate:'2027-04-23'},timetable:[item('1',4,1),item('2',4,2),item('3',4,3,{teacher:'另一教師',room:'G2106'}),item('4',2,4,{grade:'大二',className:'C1',parentClassName:'C',subjectCode:'GEF004',subject:'大學英語 IV',assessment:'報告/論文',courseType:'選修',faculty:'通識教育部'})]});
 const before=JSON.stringify(d),ws=E.scheduleSheet(X,d,d.catalog),rows=sheetRows(ws);
 assert.deepEqual(rows[0],['科目編號\nCourse Code','科目名稱\nCourse Name','學分\nCredits','必/選\nCategory','班級\nClass','上課日\nDate','上課時段\nTime','課室\nVenue','上課起止日\nDuration','授課老師\nInstructor']);
 assert.deepEqual(rows[1],['BAE102','線性代數導論\nIntroductory Linear Algebra',3,'必','1A','星期四','09:00-10:15; 10:30-11:45','金龍校區','2027/01/04-2027/04/16','示例教師']);
 assert.equal(rows[2][7],'G2106');assert.equal(rows[2][9],'另一教師');assert.equal(rows[3][1],'大學英語 IV');assert.equal(rows[3][3],'選');assert.equal(rows[3][4],'2C1');assert.equal(rows[3][8],'2027/01/04-2027/04/23');assert.equal(JSON.stringify(d),before);
 const catalog=d.catalog.map(c=>c.code==='BAE102'?{...c,englishName:'Custom verified title'}:c);assert.equal(sheetRows(E.scheduleSheet(X,d,catalog))[1][1],'線性代數導論\nCustom verified title');assert.equal(C.validate({...d,catalog}).catalog.find(c=>c.code==='BAE102').englishName,'Custom verified title');assert.equal(E.englishNameFor('BAE102','其他科目',catalog.find(c=>c.code==='BAE102')),'');
});

test('saved XLSX has real header fill, wrapping, borders and a frozen first row, including when schedule is empty',()=>{
 for(const timetable of [[],[item('a',4,1)]]){const d=state({timetable}),wb=X.utils.book_new();X.utils.book_append_sheet(wb,E.scheduleSheet(X,d,d.catalog),'排課明細');X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['原資料',42]]),'其他資料');let file;E.save(X,wb,(name,bytes,mime)=>file={name,bytes,mime});assert.match(file.name,/\.xlsx$/);assert.match(file.mime,/spreadsheetml/);const re=X.read(file.bytes,{type:'array',cellStyles:true});assert.deepEqual(re.SheetNames,['排課明細','其他資料']);assert.equal(re.Sheets['排課明細'].A1.s.fgColor.rgb,'D9D9D9');assert.equal(re.Sheets['排課明細'].J1.v,'授課老師\nInstructor');assert.equal(re.Sheets['其他資料'].B1.v,42);assert.equal(re.Sheets['其他資料'].A1.s.patternType,'none');
  const archive=X.CFB.read(file.bytes,{type:'array'}),xml=name=>new TextDecoder().decode(X.CFB.find(archive,name).content);assert.match(xml('/xl/styles.xml'),/<left style="thin">/);assert.match(xml('/xl/styles.xml'),/wrapText="1"/);assert.match(xml('/xl/worksheets/sheet1.xml'),/<pane ySplit="1"/);assert.match(xml('/xl/worksheets/sheet1.xml'),new RegExp('autoFilter ref="A1:J'+(timetable.length+1)+'"'));if(timetable.length)assert.equal(re.Sheets['排課明細'].H2.v,'金龍校區');}
});

test('semester and annual metrics join once per teacher while keeping absent data blank and measured zeros numeric',()=>{
 const upper=state({termInfo:termInfo('u','上學期'),timetable:[item('u1',1,1),item('u2',1,2,{teacher:'只教上學期'})]});let d=C.createTerm(upper,termInfo('l','下學期'),C.defaults);d=C.validate({...d,timetable:[item('l1',2,1)],unassignedBlocks:[block('pending',{teacher:'待排教師'})]});const rows=E.workloadRows(C.stats(d.unassignedBlocks,d.timetable,d.settings),C.annualWorkload(d,'2026/2027'),d);
 assert.equal(rows.length,3);const both=rows.find(r=>r['教師']==='示例教師'),prior=rows.find(r=>r['教師']==='只教上學期'),pending=rows.find(r=>r['教師']==='待排教師');assert.equal(both['已排名義學時'],22.5);assert.equal(both['全年已排'],45);assert.equal(both['上學期已排'],22.5);assert.equal(both['下學期已排'],22.5);assert.equal(prior['已排名義學時'],'');assert.equal(prior['全年已排'],22.5);assert.equal(pending['每週班級節次'],0);assert.equal(pending['全年待排學時'],22.5);assert.equal(pending['全年學年'],'2026/2027');
});

test('combined time slots retain all pressure rows and separate distribution scope from faculty-only counts',()=>{
 const d=state({timetable:[item('f',1,1),item('ext',1,1,{faculty:'通識教育部',teacher:'外院教師',className:'B'}),item('sun',7,1)]});const dayNames=['一','二','三','四','五','六','日'].map(n=>'星期'+n);const go=options=>E.periodRows(C.distribution(d.timetable,options),(day,slot)=>C.pressure(d,day,slot),dayNames);
 let rows=go({scope:'all'});assert.equal(rows.length,56);assert.equal(rows[0]['分佈實際課堂'],2);assert.equal(rows[0]['本院實際課堂'],1);assert.equal(rows[0]['佔全週課堂(%)'],100);assert.equal(rows[0]['比較時段數'],48);assert.equal(rows[48]['分佈實際課堂'],'');assert.equal(rows[48]['分佈範圍'],'未納入分佈');assert.equal(rows[48]['本院實際課堂'],1);rows=go({includeSunday:true,scope:'fof'});assert.equal(rows[0]['分佈實際課堂'],1);assert.equal(rows[0]['佔全週課堂(%)'],50);assert.equal(rows[48]['分佈實際課堂'],1);assert.equal(rows[48]['比較時段數'],56);
});
