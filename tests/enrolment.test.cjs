const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../scheduler-core.js'),E=require('../enrolment-import.js'),V=require('../ui-colors.js');
const b=(id,extra={})=>({id,program:E.programmes.BAECF,grade:'大一',className:'B',subjectCode:'BAE105',subject:'示例會計',teacher:'測試教師',room:'',assessment:'閉卷考試',...extra});
const state=extra=>C.validate({unassignedBlocks:[],timetable:[],...extra});
const row=(extra={})=>({'科目總碼':'261BAECF1BBAE10500','科目名稱':'示例會計 - BAE105-B','正選人數':24,'教室節次館別':'GDC-G2106課室Classroom 星期一 01/09:00-10:15 ;星期二 01/09:00-10:15 ;','授課教師':'測試教師','教室容量':38,'必選修別':'課程必修',sheet:'Sheet1',row:2,...extra});
const cross=extra=>row({'科目總碼':'261BAECF1IBAE10500','科目名稱':'示例會計 - BAE105-跨課程併1B','正選人數':2,'必選修別':'跨課程選修',row:3,...extra});
const options={counts:true,rooms:true,capacities:true,confirmStage:false};
test('subject assessments propagate by code across classes and new classes inherit existing form',()=>{
 const migrated=state({schemaVersion:5,unassignedBlocks:[b('old'),b('new',{className:'D',assessment:undefined})]});assert.equal(migrated.unassignedBlocks[1].assessment,'閉卷考試');
 const d=state({unassignedBlocks:[b('a',{className:'A'}),b('b',{className:'C',grade:'大二',assessment:'報告/論文'})]});C.setSubjectAssessment(d,b('draft'), '開卷考試');assert.deepEqual(d.unassignedBlocks.map(x=>x.assessment),['開卷考試','開卷考試']);assert.deepEqual(C.subjectAssessments(d,b('new',{className:'G'})),['開卷考試']);d.unassignedBlocks[0].locked=true;assert.throws(()=>C.setSubjectAssessment(d,b('draft'),'閉卷考試'),/鎖定/);
});
test('cross-programme headcounts are added once without creating lessons or extra teaching credit',()=>{
 const parsed=E.aggregate([row(),cross()]);assert.equal(parsed.groups.length,1);assert.equal(parsed.groups[0].total,26);
 const d=state({timetable:[{day:1,slot:1,block:b('a')},{day:2,slot:1,block:b('b')}]});const review=E.review(parsed,d),before=C.stats([],d.timetable,d.settings)[0].numerator;
 E.apply(d,review,options);const clean=C.validate(d);assert.equal(clean.timetable.length,2);assert.equal(clean.timetable[0].block.headcount,26);assert.deepEqual(clean.timetable[0].block.enrolment,{base:24,cross:2,term:'261',sourceIds:['261BAECF1BBAE10500','261BAECF1IBAE10500']});assert.equal(clean.timetable[0].block.room,'G2106');assert.equal(clean.rooms[0].capacity,38);assert.equal(C.stats([],clean.timetable,clean.settings)[0].numerator,before);assert.equal(before,45);E.apply(clean,review,options);assert.equal(clean.timetable[0].block.headcount,26);assert.equal(C.pressure(clean,1,1).rows[0].seats,26);
});
test('duplicate IDs cannot double count; contradictory duplicates block all affected groups',()=>{
 assert.equal(E.aggregate([row(),cross(),cross()]).groups[0].total,26);assert.equal(E.aggregate([row(),cross(),cross()]).duplicates.length,1);
 assert.ok(E.aggregate([row(),row({'正選人數':30})]).groups[0].errors.length);
 const p=E.aggregate([row(),row({'科目名稱':'示例會計 - BAE105-C'})]);assert.ok(p.groups.every(g=>g.errors.length));
});
test('missing base, missing/invalid counts, mismatched cross timetable and mixed terms remain unresolved',()=>{
 for(const rows of [[cross()],[row({'正選人數':''})],[row({'正選人數':-1})],[row(),cross({'教室節次館別':'GDC-G2107課室Classroom 星期一 01/09:00-10:15 ;'})]])assert.ok(E.aggregate(rows).groups[0].errors.length);
 assert.throws(()=>E.aggregate([row(),row({'科目總碼':'262BAECF1BBAE10500'})]),/多個學期/);
});
test('a real zero is known, counted and survives backup roundtrip',()=>{
 const d=state({unassignedBlocks:[b('a')]}),r=E.review(E.aggregate([row({'正選人數':0})]),d);E.apply(d,r,options);const clean=C.validate(JSON.parse(JSON.stringify(d)));assert.equal(clean.unassignedBlocks[0].headcount,0);assert.equal(clean.unassignedBlocks[0].enrolment.base,0);assert.equal(clean.schemaVersion,7);
});
test('multiple rooms require explicit cell mapping, never infer list order or duplicate capacity',()=>{
 const d=state({timetable:[{day:1,slot:1,block:b('a',{room:'OLD1'})},{day:2,slot:1,block:b('b',{room:'OLD2'})}],unassignedBlocks:[b('c',{room:'LAB'})]});const parsed=E.aggregate([row({'教室節次館別':'G2106課室Classroom,G2107課室Classroom 星期一 01/09:00-10:15 ;星期二 01/09:00-10:15 ;'})]);const r=E.review(parsed,d);assert.equal(r.capacities.length,0);assert.ok(r.groups[0].assignments.every(c=>!c.room));r.groups[0].assignments[0].room='G2106';E.apply(d,r,options);assert.equal(d.timetable[0].block.room,'G2106');assert.equal(d.timetable[1].block.room,'OLD2');assert.equal(d.unassignedBlocks[0].room,'LAB');assert.equal(d.timetable[0].day,1);assert.equal(d.timetable[0].slot,1);
});
test('unmatched times keep rooms, locks block import, manual target and duplicate-target protections apply',()=>{
 const d=state({timetable:[{day:3,slot:1,block:b('a',{room:'KEEP'})}]});const r=E.review(E.aggregate([row()]),d);E.apply(d,r,options);assert.equal(d.timetable[0].block.room,'KEEP');assert.equal(d.timetable[0].block.headcount,24);d.timetable[0].block.locked=true;assert.throws(()=>E.apply(d,r,options),/鎖定/);
 const unknown=E.review(E.aggregate([row()]),state({unassignedBlocks:[b('a',{program:'本科'})]}));assert.equal(unknown.groups[0].selected,false);assert.equal(unknown.groups[0].targetKey,'');
});
test('capacity differences are not silently overwritten and ambiguous source classes require review',()=>{
 const d=state({unassignedBlocks:[b('a')],rooms:[{name:'GDC-G2106',capacity:50}]});const r=E.review(E.aggregate([row()]),d);assert.equal(r.capacities[0].selected,false);E.apply(d,r,options);assert.equal(d.rooms[0].capacity,50);assert.equal(d.unassignedBlocks[0].room,'GDC-G2106');
 const unusual=E.review(E.aggregate([row({'科目總碼':'261BAECF1ABAE10500'})]),d);assert.equal(unusual.groups[0].total,24);assert.equal(unusual.groups[0].selected,false);assert.equal(unusual.groups[0].needsReview,true);
});
test('planning permits unknown rooms/counts without false scarcity, while specified labs still warn',()=>{
 const d=state({rooms:[{name:'LAB',capacity:30}],timetable:[{day:1,slot:1,block:b('a')},{day:1,slot:1,block:b('b',{className:'C',teacher:'另一教師'})}]});let p=C.pressure(d,1,1);assert.equal(V.assessment(p,1,10,'planning').label,'時間規劃中');assert.equal(V.assessment(p,1,10,'confirmed').tone,'danger');d.timetable[0].block.room='LAB';d.timetable[0].block.headcount=25;p=C.pressure(d,1,1);assert.equal(V.assessment(p,1,10,'planning').tone,'warn');d.timetable[0].block.headcount=35;p=C.pressure(d,1,1);assert.equal(V.assessment(p,1,10,'planning').tone,'danger');
});
