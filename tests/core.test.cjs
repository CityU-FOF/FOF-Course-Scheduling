const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../scheduler-core.js');
const block=(id,extra={})=>({id,program:'本科',grade:'大一',className:'A',subject:'公司金融',subjectCode:'BAE305',teacher:'江老師',room:'G2207',locked:false,...extra});
const item=(id,extra={},where={})=>({day:1,slot:1,block:block(id,extra),...where});
const slots=Array.from({length:8},(_,idx)=>({num:idx+1,time:'09:00-10:15'}));
test('legacy JSON normalizes optional fields, preserves all classes',()=>{const d=C.validate({unassignedBlocks:[block('a',{room:undefined})],timetable:[]});assert.equal(d.unassignedBlocks[0].room,'');assert.equal(d.settings.weeks,15);});
test('invalid/duplicate backups rejected before mutation',()=>{for(const raw of [{unassignedBlocks:{},timetable:[]},{unassignedBlocks:[block('a')],timetable:[item('a')]},{unassignedBlocks:[],timetable:[item('a',{}, {slot:9})]},{unassignedBlocks:[block('a',{teacher:''})],timetable:[]}])assert.throws(()=>C.validate(raw));});
test('class conflicts do not depend on teacher',()=>assert.deepEqual(C.conflicts(item('a'),item('b',{teacher:'另一老師'})),['班級撞堂','課室撞堂']));
test('teacher and room conflicts checked independently',()=>{assert.deepEqual(C.conflicts(item('a'),item('b',{className:'B',room:'G2209'})),['教師撞堂']);assert.deepEqual(C.conflicts(item('a'),item('b',{className:'B',teacher:'另一老師'})),['課室撞堂']);});
test('blank rooms never conflict',()=>assert.deepEqual(C.conflicts(item('a',{room:''}),item('b',{className:'B',teacher:'另一老師',room:''})),[]));
test('matching titles are not implicit merge permission',()=>assert.deepEqual(C.conflicts(item('a'),item('b',{className:'B'})),['教師撞堂','課室撞堂']));
test('explicit merge credits each class while physical session counts once',()=>{const a=item('a',{}, {mergeId:'M'}),b=item('b',{className:'B'}, {mergeId:'M'});assert.deepEqual(C.conflicts(a,b),[]);assert.equal(C.slotLoad([a,b],1,1).sessions,1);assert.equal(C.slotLoad([a,b],1,1).classes,2);const t=C.stats([],[a,b],C.defaults,slots)[0];assert.equal(t.classes.length,2);assert.equal(t.scheduled,2);assert.equal(t.physical,1);assert.equal(t.numerator,45);assert.equal(t.clockHours,37.5);});
test('malformed merge across subjects or times rejected',()=>{for(const b of [item('b',{className:'B',subjectCode:'BAE306'},{mergeId:'M'}),item('b',{className:'B'},{mergeId:'M',slot:2})])assert.throws(()=>C.validate({unassignedBlocks:[],timetable:[item('a',{}, {mergeId:'M'}),b]}));});
test('two 75 minute weekly sessions at 15 weeks are 45 academic hours at 50min',()=>{const t=C.stats([],[item('a'),item('b',{}, {slot:2})],C.defaults,slots)[0];assert.equal(t.numerator,45);assert.equal(t.clockHours,37.5);});
test('all class groups retained beyond six and include programme/year identity',()=>{const pool=Array.from({length:8},(_,i)=>block(String(i),{className:String(i)}));assert.equal(C.stats(pool,[],C.defaults,slots)[0].classes.length,8);});
test('pending adds explicit upper bound, configurable academic minutes',()=>{const t=C.stats([block('b')],[item('a')],{weeks:10,academicMinutes:60},slots)[0];assert.equal(t.numerator,12.5);assert.equal(t.denominator,25);});
test('audit reports all collision pairs across whole faculty',()=>{assert.equal(C.audit([item('a'),item('b',{className:'B'}),item('c',{teacher:'T'})]).length,3);});
const state=extra=>C.validate({unassignedBlocks:[],timetable:[],...extra});
test('v2 upgrades to v3.1 backup schema with no invented room capacity or class size',()=>{const d=state({schemaVersion:2,unassignedBlocks:[block('a')]});assert.equal(d.schemaVersion,7);assert.deepEqual(d.rooms,[]);assert.equal(d.unassignedBlocks[0].headcount,null);});
test('room names canonicalized and duplicate room definitions rejected',()=>{assert.equal(state({rooms:[{name:'g2207',capacity:70}]}).rooms[0].name,'G2207');assert.throws(()=>state({rooms:[{name:'g2207',capacity:70},{name:'G2207',capacity:80}]}));});
test('teacher restriction blocks placement while unrelated teacher can place',()=>{const d=state({unassignedBlocks:[block('a')],rules:[{id:'r',kind:'teacher',target:'江老師',cells:['1:1'],reason:'外出'}]});assert.equal(C.placement(d,'a',1,1).ok,false);assert.match(C.placement(d,'a',1,1).message,/外出/);assert.equal(C.placement(d,'a',1,2).ok,true);assert.equal(C.restrictions(d.rules,block('b',{teacher:'T'}),1,1).length,0);});
test('global, programme, class and room restrictions have precise scope',()=>{for(const [kind,target] of [['global',''],['program','本科'],['class',C.cls(block('a'))],['room','G2207']]){const rules=[{kind,target,cells:['2:4']}];assert.equal(C.restrictions(rules,block('a'),2,4).length,1);assert.equal(C.restrictions(rules,block('a'),2,3).length,0);}});
test('restriction audit keeps existing lesson and flags it',()=>{const d=state({timetable:[item('a')],rules:[{id:'r',kind:'global',target:'',cells:['1:1'],reason:'會議'}]});assert.equal(d.timetable.length,1);assert.equal(C.fullAudit(d)[0].type,'排課限制');});
test('merge room demand sums classes and rejects capacity overflow',()=>{const d=state({rooms:[{name:'G2207',capacity:60}],unassignedBlocks:[block('b',{className:'B',headcount:35})],timetable:[item('a',{headcount:30})]});assert.match(C.placement(d,'b',1,1).message,/容量不足/);d.rooms[0].capacity=65;assert.equal(C.placement(d,'b',1,1).needsMerge,true);});
test('unknown headcount is not zero and capacity ratio is lower bound',()=>{const d=state({rooms:[{name:'G2207',capacity:60}],timetable:[item('a',{headcount:35},{mergeId:'m'}),item('b',{className:'B'},{mergeId:'m'})]});const p=C.pressure(d,1,1);assert.equal(p.rows[0].unknown,1);assert.equal(p.rows[0].seats,35);assert.equal(p.rows[0].sessions,1);assert.equal(p.unknownClasses,1);});
test('room closed at slot is excluded from available inventory',()=>{const d=state({rooms:[{name:'G2207',capacity:60},{name:'G2209',capacity:80}],rules:[{id:'r',kind:'room',target:'G2207',cells:['1:1'],reason:'維修'}]});assert.equal(C.pressure(d,1,1).availableRooms,1);assert.equal(C.pressure(d,1,1).totalSeats,80);});
test('overcapacity discovered after inventory reduction',()=>{const d=state({rooms:[{name:'G2207',capacity:30}],timetable:[item('a',{headcount:35})]});assert.equal(C.fullAudit(d)[0].type,'課室超容量');});
test('holiday impact uses inclusive semester dates and one row per class/date',()=>{const d=state({settings:{...C.defaults,startDate:'2026-11-02',endDate:'2026-11-02'},timetable:[item('a'),item('b',{className:'B'},{mergeId:undefined})],holidays:[{id:'h',date:'2026-11-02',name:'追思節'},{id:'h2',date:'2026-11-02',name:'學院停課'}]});const rows=C.holidayImpacts(d);assert.equal(rows.length,2);assert.equal(rows[0].names.length,2);d.holidays[0].enabled=false;d.holidays[1].enabled=false;assert.equal(C.holidayImpacts(d).length,0);});
test('partial-day holiday only affects overlapping lesson (no boundary collision)',()=>{const d=state({settings:{...C.defaults,startDate:'2026-11-01',endDate:'2026-11-07'},timetable:[item('a'),item('b',{}, {slot:2})],holidays:[{id:'h',date:'2026-11-02',name:'上午活動',start:615,end:645}]});assert.equal(C.holidayImpacts(d).length,1);assert.equal(C.holidayImpacts(d)[0].item.slot,2);});
test('holiday followup persists independently without changing nominal hours',()=>{const d=state({settings:{...C.defaults,startDate:'2026-11-01',endDate:'2026-11-07'},timetable:[item('a')],holidays:[{id:'h',date:'2026-11-02',name:'假期'}],followups:{'2026-11-02|a':{status:'planned',note:'待確認'}}});assert.equal(C.holidayImpacts(d)[0].status,'planned');assert.equal(C.stats([],d.timetable,d.settings)[0].numerator,22.5);});
test('invalid calendar dates, mixed semester ranges, invalid rules reject',()=>{assert.throws(()=>state({settings:{...C.defaults,startDate:'2026-02-30',endDate:'2026-03-01'}}));assert.throws(()=>state({settings:{...C.defaults,startDate:'2026-01-01',endDate:''}}));assert.throws(()=>state({rules:[{id:'r',kind:'teacher',target:'T',cells:['8:1']}]}));assert.equal(C.dateISO('2028-02-29'),true);});
test('CSV supports quotes, BOM, partial day and explicit disabled flag',()=>{const rows=C.parseHolidayCSV('\uFEFFdate,name,start,end,enabled\r\n2026-11-02,"假期,一",13:00,17:00,false');assert.equal(rows[0].name,'假期,一');assert.equal(rows[0].start,780);assert.equal(rows[0].enabled,false);});
test('ICS all-day exclusive end and folded summary',()=>{const rows=C.parseICS('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261102\nDTEND;VALUE=DATE:20261104\nSUMMARY:學院\n 停課\nEND:VEVENT\nEND:VCALENDAR');assert.equal(rows.length,2);assert.equal(rows[1].date,'2026-11-03');assert.equal(rows[0].name,'學院停課');});
test('ICS UTC converted to local UTC+8 and cross-date partitioned',()=>{const rows=C.parseICS('BEGIN:VEVENT\nDTSTART:20261102T150000Z\nDTEND:20261102T170000Z\nSUMMARY:停課\nEND:VEVENT');assert.equal(rows.length,2);assert.equal(rows[0].start,1380);assert.equal(rows[1].date,'2026-11-03');assert.equal(rows[1].end,60);});
test('unsupported recurrence, timezones and missing end rejected without partial import',()=>{for(const entry of ['DTSTART:20261102T090000\nSUMMARY:X','DTSTART;VALUE=DATE:20261102\nSUMMARY:X\nRRULE:FREQ=YEARLY','DTSTART;TZID=Europe/London:20261102T090000\nDTEND;TZID=Europe/London:20261102T100000\nSUMMARY:X'])assert.throws(()=>C.parseICS('BEGIN:VEVENT\n'+entry+'\nEND:VEVENT'));});
test('holiday range includes both endpoints and clips to semester across year',()=>{const d=state({settings:{...C.defaults,startDate:'2026-12-28',endDate:'2027-01-11'},timetable:[item('a')],holidays:[{id:'h',date:'2026-12-20',endDate:'2027-01-11',name:'寒假'}]});assert.deepEqual(C.holidayImpacts(d).map(r=>r.date),['2026-12-28','2027-01-04','2027-01-11']);});
test('holiday range overlapping single holiday never duplicates class-date rows',()=>{const d=state({settings:{...C.defaults,startDate:'2026-11-01',endDate:'2026-11-16'},timetable:[item('a')],holidays:[{id:'h',date:'2026-11-01',endDate:'2026-11-16',name:'學院假期'},{id:'s',date:'2026-11-02',name:'追思節'}]});assert.equal(C.holidayImpacts(d).length,3);assert.equal(C.holidayImpacts(d)[0].names.length,2);});
test('invalid or too-long holiday ranges rejected; old single dates upgraded losslessly',()=>{for(const endDate of ['2026-10-31','2027-02-30','2028-01-01'])assert.throws(()=>state({holidays:[{id:'h',date:'2026-11-01',endDate,name:'假期'}]}));assert.equal(state({holidays:[{id:'h',date:'2026-11-02',name:'單日'}]}).holidays[0].endDate,'2026-11-02');});
test('CSV optional end_date imports range while old CSV remains single date',()=>{assert.equal(C.parseHolidayCSV('date,end_date,name\n2027-01-01,2027-02-01,寒假')[0].endDate,'2027-02-01');assert.equal(C.parseHolidayCSV('date,name\n2027-01-01,元旦')[0].endDate,'2027-01-01');});
test('suggestions exclude teacher exclusions, class collision and weekends by default',()=>{const d=state({unassignedBlocks:[block('a')],timetable:[item('b',{teacher:'T'})],rules:[{id:'r',kind:'teacher',target:'江老師',cells:['1:2'],reason:'外出'}]});const out=C.suggestions(d,'a');assert.ok(out.length);assert.ok(out.every(x=>x.day<=5&&!(x.day===1&&[1,2].includes(x.slot))));assert.ok(out.every(x=>C.placement(d,'a',x.day,x.slot).ok));});
test('suggestions reject all known overcapacity and respect locked blocks',()=>{const d=state({rooms:[{name:'G2207',capacity:20}],unassignedBlocks:[block('a',{headcount:30})]});assert.deepEqual(C.suggestions(d,'a'),[]);d.rooms[0].capacity=40;d.unassignedBlocks[0].locked=true;assert.deepEqual(C.suggestions(d,'a'),[]);});
test('compact suggestion preference favours teacher adjacent slot without changing data',()=>{const d=state({unassignedBlocks:[block('a',{className:'B'})],timetable:[item('b',{subject:'另一科',subjectCode:'BAE300'}, {day:3,slot:4})]});const before=JSON.stringify(d),out=C.suggestions(d,'a','compact');assert.equal(out[0].day,3);assert.ok([3,5].includes(out[0].slot));assert.equal(JSON.stringify(d),before);});
test('fully blocked weekdays can be supplemented by optional weekend candidates',()=>{const cells=[];for(let d=1;d<=5;d++)for(let s=1;s<=8;s++)cells.push(d+':'+s);const d=state({unassignedBlocks:[block('a')],rules:[{id:'r',kind:'global',target:'',cells,reason:'禁排'}]});assert.deepEqual(C.suggestions(d,'a'),[]);assert.ok(C.suggestions(d,'a','balanced',true).every(x=>x.day>=6));});

test('schema 6 migrates old metadata conservatively and rejects malformed fields',()=>{
 const b=state({schemaVersion:4,unassignedBlocks:[block('a')]}).unassignedBlocks[0];assert.equal(b.assessment,'未設定');assert.equal(b.credits,3);assert.equal(b.courseType,'必修');assert.equal(b.faculty,'金融學院');
 for(const extra of [{assessment:'其他'},{credits:-1},{credits:null},{credits:''},{faculty:' '},{courseType:'自選'}])assert.throws(()=>state({unassignedBlocks:[block('x',extra)]}));
 const d=state({unassignedBlocks:[block('r',{assessment:'閉卷考試',faculty:'通識教育部',credits:2,courseType:'選修'})]});assert.deepEqual(C.validate(JSON.parse(JSON.stringify(d))),d);
});
test('assessment changes regular period and holidays while workload includes the examination week',()=>{
 const settings={...C.defaults,startDate:'2026-08-24',endDate:'2026-12-04'};
 const exam=block('e',{assessment:'開卷考試'}),report=block('r',{assessment:'報告/論文',className:'B'});
 assert.deepEqual(C.teachingPeriod(exam,settings),{start:'2026-08-24',end:'2026-11-27',weeks:14});assert.equal(C.teachingPeriod(report,settings).end,'2026-12-04');assert.equal(C.teachingWeeks({...exam,assessment:'閉卷考試'},settings),14);
 const t=C.stats([],[{day:1,slot:1,block:exam},{day:1,slot:2,block:report}],settings)[0];assert.equal(t.numerator,45);assert.equal(t.clockHours,37.5);
 assert.equal(C.stats([exam],[],settings)[0].denominator,22.5);
 const d=state({settings,timetable:[{day:1,slot:1,block:exam},{day:1,slot:2,block:report}],holidays:[{id:'h',date:'2026-11-30',name:'停課'}]});assert.deepEqual(C.holidayImpacts(d).map(r=>r.item.block.id),['r']);
 assert.equal(C.teachingWeeks(exam,{...settings,weeks:10}),10);
});
test('external lessons block class and room clashes but contribute no faculty pressure or credit',()=>{
 const ext=block('x',{faculty:'通識教育部',teacher:'外院教師',assessment:'報告/論文',headcount:100});
 const d=state({rooms:[{name:'G2207',capacity:20}],unassignedBlocks:[ext,block('f',{teacher:'本院教師',headcount:10})]});
 assert.equal(C.placement(d,'x',1,1).ok,true);d.unassignedBlocks=d.unassignedBlocks.filter(b=>b.id!=='x');d.timetable.push({day:1,slot:1,block:ext});
 assert.equal(C.placement(d,'f',1,1).ok,false);assert.equal(C.pressure(d,1,1).sessions,0);assert.equal(C.pressure(d,1,1).overRooms,0);assert.equal(C.pressure(d,1,1).unknownClasses,0);assert.equal(C.roomPressure(d,1,1)[0].seats,0);
 const stats=C.stats(d.unassignedBlocks,d.timetable,d.settings);assert.equal(stats.length,1);assert.equal(stats[0].name,'本院教師');assert.equal(stats[0].numerator,0);
});
test('Excel combines exact day/time patterns without inventing Cartesian combinations',()=>{
 const settings={...C.defaults,startDate:'2026-08-24',endDate:'2026-12-04'},b=block('a',{assessment:'閉卷考試',credits:3,courseType:'選修'});
 const make=(id,day,slot,extra={})=>({day,slot,block:{...b,id,...extra}});
 let d=state({settings,timetable:[make('a',1,1),make('b',1,2)]}),rows=C.scheduleRows(d);
 assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]),['科目編號','科目名','學分','必修/選修','班級','星期','時間','課室','上課期間']);assert.equal(rows[0]['星期'],'星期一');assert.equal(rows[0]['時間'],'09:00-10:15; 10:30-11:45');assert.equal(rows[0]['上課期間'],'2026.08.24-2026.11.27');
 d=state({settings,timetable:[make('a',1,5),make('b',3,5)]});rows=C.scheduleRows(d);assert.equal(rows.length,1);assert.equal(rows[0]['星期'],'星期一、星期三');assert.equal(rows[0]['時間'],'15:00-16:15');
 d=state({settings,timetable:[make('a',1,1),make('b',1,2),make('c',3,1)]});assert.equal(C.scheduleRows(d).length,2);
 d=state({settings,timetable:[make('a',1,1),make('b',1,2,{room:'G2209'}),make('c',1,3,{faculty:'通識教育部',assessment:'報告/論文'})]});rows=C.scheduleRows(d);assert.equal(rows.length,3);assert.ok(rows.some(r=>r['上課期間']==='2026.08.24-2026.12.04'));assert.equal(rows[0]['學分'],3);
});

test('distribution measures 20 of 48 lessons as 41.67 percent and twenty times the slot average',()=>{
 const tt=Array.from({length:48},(_,n)=>item('d'+n,{className:'C'+n,teacher:'T'+n,room:''},n<20?{day:1,slot:1}:{day:Math.floor((n-19)/8)+1,slot:(n-19)%8+1}));const d=C.distribution(tt),c=d.cells.find(c=>c.day===1&&c.slot===1);
 assert.equal(d.slotCount,48);assert.equal(d.totalSessions,48);assert.equal(d.average,1);assert.equal(C.round(c.share),41.67);assert.equal(c.multiple,20);assert.equal(c.tone,'danger');assert.ok(Math.abs(d.cells.reduce((sum,c)=>sum+c.share,0)-100)<1e-9);
});
test('distribution handles empty plans, sparse samples, merges, external courses and unknown people',()=>{
 const empty=C.distribution([]);assert.equal(empty.totalSessions,0);assert.ok(empty.cells.every(c=>c.share===0&&c.multiple===0&&c.tone==='empty'));
 const tt=[item('a',{headcount:20},{mergeId:'M'}),item('b',{className:'B',headcount:10},{mergeId:'M'}),item('e',{faculty:'通識教育部',teacher:'外院',className:'C',headcount:null}, {day:2,slot:2})];const d=C.distribution(tt);assert.equal(d.totalSessions,2);assert.equal(d.cells[0].sessions,1);assert.equal(d.cells[0].people,30);assert.equal(d.cells[0].tone,'healthy');assert.equal(d.cells.find(c=>c.day===2&&c.slot===2).unknownPeople,1);assert.equal(C.distribution(tt,{scope:'fof'}).totalSessions,1);
});
test('Sunday switches denominator and colour follows a moved lesson without changing data',()=>{
 const tt=[item('a'),item('b',{className:'B'}),item('s',{className:'S'},{day:7})],original=JSON.stringify(tt);const d=C.distribution(tt);assert.equal(d.totalSessions,2);assert.equal(d.outsideSessions,1);assert.equal(d.cells[0].tone,'danger');const sunday=C.distribution(tt,{includeSunday:true});assert.equal(sunday.slotCount,56);assert.equal(sunday.totalSessions,3);assert.equal(sunday.outsideSessions,0);assert.equal(JSON.stringify(tt),original);const moved=tt.map(i=>i.block.id==='b'?{...i,day:2}:i);assert.equal(C.distribution(moved).cells[0].tone,'healthy');
});
test('room names sort numerically and GDC aliases stay beside the same room number',()=>{
 const names=['G2216','G2209','G2207','G2201','GDC-G2106','G404','G2209'];const before=[...names];assert.deepEqual(C.sortRoomNames(names),['G404','GDC-G2106','G2201','G2207','G2209','G2216']);assert.deepEqual(names,before);
});

test('same-code classes trigger merge despite display-name variation and an unassigned room',()=>{
 const d=state({unassignedBlocks:[block('b',{className:'B',room:'',subject:'公司金融（中文名稱）'})],timetable:[item('a')]});const p=C.placement(d,'b',1,1);assert.equal(p.needsMerge,true);assert.equal(p.ok,true);assert.equal(p.proposedRoom,'G2207');assert.equal(C.placement(d,'b',1,1,{mergeRoom:'G2207'}).ok,true);
});
test('different known rooms require a common-room choice and recheck combined capacity and restrictions',()=>{
 const d=state({rooms:[{name:'G2207',capacity:50},{name:'G2209',capacity:80}],unassignedBlocks:[block('b',{className:'B',room:'G2209',headcount:30})],timetable:[item('a',{headcount:30})]});const p=C.placement(d,'b',1,1);assert.equal(p.needsMerge,true);assert.equal(p.requiresRoomChoice,true);assert.equal(C.placement(d,'b',1,1,{mergeRoom:''}).ok,false);assert.match(C.placement(d,'b',1,1,{mergeRoom:'G2207'}).message,/容量不足/);assert.equal(C.placement(d,'b',1,1,{mergeRoom:'G2209'}).ok,true);d.rules.push({id:'r',kind:'room',target:'G2209',cells:['1:1'],reason:'維修'});assert.equal(C.placement(d,'b',1,1,{mergeRoom:'G2209'}).ok,false);d.rooms[0].capacity=80;assert.equal(C.placement(d,'b',1,1,{mergeRoom:'G2207'}).ok,true);
});
test('an alternative common room cannot collide with another teacher and unconfigured differing subject codes never merge',()=>{
 const d=state({unassignedBlocks:[block('b',{className:'B',room:''})],timetable:[item('a'),item('c',{className:'C',teacher:'另一教師',room:'G2209'})]});assert.equal(C.placement(d,'b',1,1,{mergeRoom:'G2209'}).ok,false);d.unassignedBlocks[0].subjectCode='BAE999';assert.equal(C.placement(d,'b',1,1).needsMerge,undefined);assert.equal(C.placement(d,'b',1,1).ok,false);
});

test('configured BAE406/411 exception permits confirmed cross-code merge and retains additive credit',()=>{
 const a=item('a',{subjectCode:'BAE406',subject:'金融與經濟研究方法',assessment:'閉卷考試'}),b=block('b',{className:'I',subjectCode:'BAE411',subject:'金融與經濟研究方法',assessment:'報告/論文'});const d=state({timetable:[a],unassignedBlocks:[b]});assert.equal(C.placement(d,'b',1,1).needsMerge,true);
 a.mergeId='SPECIAL';d.timetable=[a,{day:1,slot:1,block:b,mergeId:'SPECIAL'}];d.unassignedBlocks=[];const v=C.validate(d);assert.equal(C.fullAudit(v).length,0);assert.equal(C.stats([],v.timetable,v.settings)[0].numerator,45);assert.equal(C.distribution(v.timetable).totalSessions,1);assert.deepEqual(v.timetable.map(i=>i.block.subjectCode),['BAE406','BAE411']);assert.deepEqual(v.timetable.map(i=>i.block.assessment),['閉卷考試','報告/論文']);assert.deepEqual(C.validate(JSON.parse(JSON.stringify(v))),v);
 assert.throws(()=>C.validate({...v,mergeExceptions:[]}),/例外/);
});
test('same-name BAE407/412 remain independent without an explicit exception; different teachers still cannot merge',()=>{
 let d=state({timetable:[item('a',{subjectCode:'BAE407',subject:'實證方法與建模'})],unassignedBlocks:[block('b',{className:'I',subjectCode:'BAE412',subject:'實證方法與建模'})]});assert.equal(C.placement(d,'b',1,1).ok,false);d=state({timetable:[item('a',{subjectCode:'BAE406'})],unassignedBlocks:[block('b',{className:'I',subjectCode:'BAE411'})],mergeExceptions:[]});assert.equal(C.placement(d,'b',1,1).ok,false);d.unassignedBlocks[0].teacher='其他教師';assert.equal(C.placement(d,'b',1,1).needsMerge,false);
});
test('cross-code exception is pair-specific and does not transitively merge a third subject',()=>{
 const rules=[{id:'a',codes:['BAE406','BAE411'],enabled:true,reason:'例外'},{id:'b',codes:['BAE411','BAE999'],enabled:true,reason:'例外'}];const tt=['BAE406','BAE411','BAE999'].map((code,n)=>item('x'+n,{subjectCode:code,className:String(n)},{mergeId:'M'}));assert.throws(()=>state({timetable:tt,mergeExceptions:rules}),/例外/);
});
test('catalogue preserves separate same-name codes, unset defaults and editable semester/direction fields',()=>{
 const d=state({});assert.equal(d.schemaVersion,7);const a=d.catalog.find(c=>c.code==='BAE406'),b=d.catalog.find(c=>c.code==='BAE411');assert.equal(a.name,b.name);assert.notDeepEqual(a.directions,b.directions);assert.equal(a.credits,null);assert.equal(a.courseType,'');assert.deepEqual(a.terms,[]);a.credits=2;a.courseType='選修';a.terms=['下學期'];assert.deepEqual(C.validate(JSON.parse(JSON.stringify(d))).catalog,d.catalog);assert.throws(()=>state({catalog:[a,a]}),/重複/);assert.throws(()=>state({catalog:[{...a,terms:['猜測學期']}]}),/不正確/);assert.throws(()=>state({mergeExceptions:[{id:'bad',codes:['BAE406','BAE406'],enabled:true,reason:''}]}),/不同編號/);
});
