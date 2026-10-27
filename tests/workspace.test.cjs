const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../scheduler-core.js');
const base=(id,n=0,extra={})=>({id,program:C.programmes[0].name,grade:'大一',className:'A',subjectCode:'BAE'+(101+Math.floor(n/2)),subject:'示例科目'+Math.floor(n/2),teacher:'測試教師',room:'',assessment:'閉卷考試',...extra});
function term(year,semester,count,{finalized=false,pending=0,extra={}}={}){return C.validate({unassignedBlocks:Array.from({length:pending},(_,n)=>base('p'+n,n+count)),timetable:Array.from({length:count},(_,n)=>({day:1+Math.floor(n/8),slot:1+n%8,block:base('b'+n,n)})),termInfo:{id:year+'-'+semester,academicYear:year,semester,finalized},...extra});}
function combine(active,...others){return C.validate({...active,archives:others.map(C.termSnapshot)});}

test('catalogue ownership is inferred from exact known prefixes and supports multiple selected programmes',()=>{
 const d=term('2026/2027','上學期',0),bae=d.catalog.find(c=>c.code==='BAE101');assert.deepEqual(bae.programs,['BAECF']);assert.equal(C.catalogBelongs(bae,'MFI'),false);assert.equal(C.catalogBelongs(bae,'BAE'),true);
 for(const [code,owner] of [['MFI501','MFICF'],['MFT501','MFTBF'],['DFI701','DFICF']])assert.deepEqual(C.inferPrograms(code),[owner]);assert.deepEqual(C.inferPrograms('GE101'),[]);assert.deepEqual(C.inferPrograms('BAEX101'),[]);
 const common={...bae,code:'GE101',programs:['BAE','MFI']},v=C.validate({...d,catalog:[common]});assert.deepEqual(v.catalog[0].programs,['BAECF','MFICF']);assert.ok(C.catalogBelongs(v.catalog[0],'Master of Finance'));assert.equal(C.catalogBelongs(v.catalog[0],'MFT'),false);
});

test('old single-term backup gains a baseline offering plan without inventing year or moving lessons',()=>{
 const b=base('old'),d=C.validate({schemaVersion:8,unassignedBlocks:[b],timetable:[]});assert.equal(d.schemaVersion,10);assert.equal(d.termInfo.academicYear,'');assert.equal(d.termInfo.semester,'未設定');assert.deepEqual(d.archives,[]);assert.deepEqual(C.annualWorkload(d,'').rows,[]);assert.equal(d.offeringPlan.length,1);assert.equal(d.offeringPlan[0].targets[0].lessons,1);assert.equal(d.unassignedBlocks[0].id,'old');assert.equal(C.offeringProgress(d).openedPercent,100);assert.deepEqual(C.validate(JSON.parse(JSON.stringify(d))),d);
});

test('opening completion requires all target classes and lessons; spare lessons cannot cover another missing class',()=>{
 const p={id:'p',program:C.programmes[0].name,grade:'大一',subjectCode:'BAE101',subject:'示例科目',targets:['A','B','C'].map(className=>({className,lessons:2}))};const blocks=['A','A','A','B','B','C'].map((className,n)=>base('b'+n,0,{className}));let d=C.validate({unassignedBlocks:blocks,timetable:[],offeringPlan:[p,{...p,id:'p2',subjectCode:'BAE103',targets:[]}]});let s=C.offeringProgress(d);assert.equal(s.total,2);assert.equal(s.opened,0);assert.ok(s.rows[0].partial);assert.equal(s.rows[0].covered,5);assert.equal(s.rows[0].created,6);
 d.unassignedBlocks.push(base('last',0,{className:'C'}));s=C.offeringProgress(C.validate(d));assert.equal(s.openedPercent,50);assert.equal(s.remainingPercent,50);d.unassignedBlocks=d.unassignedBlocks.filter(b=>b.id!=='last');assert.equal(C.offeringProgress(d).opened,0);assert.equal(C.offeringProgress(d,'MFI').total,0);
});

test('creating and switching semesters retains complete independent snapshots and does not copy term exceptions',()=>{
 let upper=term('2026/2027','上學期',2,{extra:{rooms:[{name:'G1',capacity:30}],holidays:[{id:'h',date:'2026-09-01',name:'假期'}],rules:[{id:'r',kind:'teacher',target:'其他教師',cells:['1:1'],reason:'上學期限制'}]}});const before=C.termSnapshot(upper);let lower=C.createTerm(upper,{id:'lower',academicYear:'2026/2027',semester:'下學期'},C.defaults);assert.equal(upper.archives.length,0);assert.deepEqual(lower.archives[0],before);assert.equal(lower.timetable.length,0);assert.equal(lower.rooms.length,1);assert.deepEqual(lower.holidays,[]);assert.deepEqual(lower.rules,[]);assert.deepEqual(lower.mergeExceptions,[]);
 lower.settings.startDate='2027-02-01';lower.settings.endDate='2027-06-30';lower.holidayCalendar.push({id:'new',date:'2027-03-01',name:'新假期',endDate:'2027-03-01',start:0,end:1440,enabled:true,source:''});const switched=C.switchTerm(lower,upper.termInfo.id);assert.deepEqual(C.termSnapshot(switched),before);assert.equal(switched.archives[0].holidays[0].name,'新假期');assert.equal(C.switchTerm(switched,'lower').holidays[0].id,'new');assert.deepEqual(C.validate(JSON.parse(JSON.stringify(switched))),switched);
});

test('duplicate semester identity, nested archives, invalid plans and future backup versions reject atomically',()=>{
 const d=term('2026/2027','上學期',0),before=JSON.stringify(d);assert.throws(()=>C.createTerm(d,{id:'x',academicYear:'2026/2027',semester:'上學期'},C.defaults),/已存在/);assert.equal(JSON.stringify(d),before);
 const snap=C.termSnapshot(term('2026/2027','下學期',0));for(const bad of [{...snap,archives:[]},{...snap,termInfo:{...snap.termInfo,id:d.termInfo.id}},{...snap,offeringPlan:[{id:'broken'}]}])assert.throws(()=>C.validate({...d,archives:[bad]}));assert.throws(()=>C.validate({...d,schemaVersion:11}),/不支援/);assert.throws(()=>C.validate({...d,termInfo:{...d.termInfo,academicYear:'2026/2028'}}),/學期/);
});

test('annual workload separates scheduled and pending allocation: 225 plus 135 reaches 360',()=>{
 const upper=term('2026/2027','上學期',10,{finalized:true}),lower=term('2026/2027','下學期',0,{pending:6});let d=combine(lower,upper),a=C.annualWorkload(d,'2026/2027');assert.equal(a.rows[0].upper,225);assert.equal(a.rows[0].lower,0);assert.equal(a.rows[0].scheduled,225);assert.equal(a.rows[0].pending,135);assert.equal(a.rows[0].planned,360);assert.equal(a.rows[0].remaining,135);assert.equal(a.rows[0].toAllocate,0);assert.equal(a.complete,false);
 d=combine(term('2026/2027','下學期',6,{finalized:true}),upper);a=C.annualWorkload(d,'2026/2027');assert.equal(a.rows[0].scheduled,360);assert.equal(a.rows[0].pending,0);assert.equal(a.complete,true);assert.equal(C.annualWorkload(d,'2027/2028').rows[0].priorBalance,0);const unknown=term('2026/2027','未設定',0);assert.equal(C.annualWorkload(C.validate({...d,archives:[...d.archives,C.termSnapshot(unknown)]}),'2026/2027').complete,false);
});

test('prior-year excess provides a reference and explicit carry adjustment prevents repeated deductions',()=>{
 const u=term('2025/2026','上學期',10,{finalized:true}),l=term('2025/2026','下學期',8,{finalized:true});let d=combine(term('2026/2027','上學期',10,{finalized:true}),u,l,term('2026/2027','下學期',4,{finalized:true}));let row=C.annualWorkload(d,'2026/2027').rows[0];assert.equal(row.priorBalance,-45);assert.equal(row.suggestedTarget,315);assert.equal(row.target,360);
 d.workload.teacherTargets.push({academicYear:'2026/2027',teacher:'測試教師',target:360,carryIn:-45,note:'確認少排45'});d=C.validate(d);row=C.annualWorkload(d,'2026/2027').rows[0];assert.equal(row.target,315);assert.equal(row.remaining,0);assert.equal(C.annualWorkload(d,'2027/2028').rows[0].priorBalance,0);assert.equal(C.annualWorkload(d,'2027/2028').rows[0].suggestedTarget,360);
});

test('under-allocation and zero-hour named targets produce next-year reminders only after both terms finalized',()=>{
 let d=combine(term('2025/2026','上學期',10,{finalized:true}),term('2025/2026','下學期',4));assert.equal(C.annualWorkload(d,'2026/2027').rows.length,0);d.archives[0].termInfo.finalized=true;d.workload.teacherTargets.push({academicYear:'2025/2026',teacher:'零課時教師',target:180,carryIn:0,note:''});d=C.validate(d);const rows=C.annualWorkload(d,'2026/2027').rows;assert.equal(rows.find(r=>r.name==='測試教師').priorBalance,45);assert.equal(rows.find(r=>r.name==='測試教師').suggestedTarget,405);assert.equal(rows.find(r=>r.name==='零課時教師').priorBalance,180);
});

test('annual hours use each term academic-minute basis, keep merged-class additive credit and exclude external teachers',()=>{
 const a=base('a'),b=base('b',0,{className:'B'}),ext=base('ext',0,{teacher:'外院教師',faculty:'通識教育部'});const u=term('2026/2027','上學期',0,{extra:{timetable:[{day:1,slot:1,mergeId:'m',block:a},{day:1,slot:1,mergeId:'m',block:b},{day:2,slot:1,block:ext}]}}),l=term('2026/2027','下學期',2,{extra:{settings:{...C.defaults,academicMinutes:60}}}),d=combine(l,u),rows=C.annualWorkload(d,'2026/2027').rows;assert.equal(rows.length,1);assert.equal(rows[0].upper,45);assert.equal(rows[0].lower,37.5);assert.equal(rows[0].scheduled,82.5);
});

test('single-term import preserves existing terms, masters and annual targets while adding missing facts',()=>{
 const d=term('2026/2027','上學期',2),incoming=term('2025/2026','下學期',2);incoming.workload.yearTargets=[{academicYear:'2025/2026',target:350},{academicYear:'2024/2025',target:320}];incoming.workload.teacherTargets=[{academicYear:'2025/2026',teacher:'測試教師',target:300,carryIn:0,note:'來源核對'}];d.catalog[0].credits=2;incoming.catalog[0].credits=4;const before=JSON.stringify(d),merged=C.importTerm(d,incoming,'imported');assert.equal(JSON.stringify(d),before);assert.equal(merged.archives.length,1);assert.equal(merged.catalog[0].credits,2);assert.equal(merged.workload.teacherTargets[0].target,300);assert.equal(merged.workload.yearTargets.length,1);assert.equal(C.switchTerm(merged,'imported').timetable.length,2);assert.throws(()=>C.importTerm(merged,incoming,'again'),/已存在/);assert.throws(()=>C.importTerm(d,merged,'bad'),/多學期/);
});

test('finalized term validation rejects missing year, pending lessons or incomplete planned offerings',()=>{
 for(const d of [term('2026/2027','上學期',0,{pending:1}),term('2026/2027','上學期',0,{extra:{offeringPlan:[{id:'p',program:'本科',grade:'大一',subjectCode:'BAE101',subject:'測試科',targets:[]}]}})])assert.throws(()=>C.validate({...d,termInfo:{...d.termInfo,finalized:true}}),/確認核算/);
 const d=term('2026/2027','上學期',0);assert.throws(()=>C.validate({...d,termInfo:{...d.termInfo,academicYear:'',finalized:true}}),/確認核算/);assert.throws(()=>C.validate({...d,workload:{yearTargets:[],teacherTargets:[{academicYear:'2026/2027',teacher:'測試',target:360,carryIn:-361,note:''}]}}),/結轉/);
});
