const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../scheduler-core.js'),E=require('../enrolment-import.js');
const program=C.programmes[0].name;
const lesson=(id,className='C',extra={})=>({id,program,grade:'大二',className,subjectCode:'GEF004',subject:'大學英語 IV',faculty:'通識教育部',teacher:'示例教師'+id,room:'',assessment:'閉卷考試',...extra});
const section=(id,className='C1',extra={})=>lesson(id,className,{parentClassName:className[0],...extra});
const slot=(block,day=1,slot=1)=>({day,slot,block});
const state=extra=>C.validate({unassignedBlocks:[],timetable:[],...extra});

test('custom allocation supports mixed full and subdivided classes, independent teachers and weekly targets',()=>{
 const names=['A','B1','C1','C2','C3','D1','D2'],sections=names.map((className,n)=>({className,teacher:'教師'+n,lessons:n===4?1:''}));
 const out=C.expandSectionAssignments({sections,lessons:2});assert.deepEqual(out.map(a=>a.className),names);assert.deepEqual(out.map(a=>a.parentClassName),[undefined,'B','C','C','C','D','D']);assert.deepEqual(out.map(a=>a.lessons),[2,2,2,2,1,2,2]);assert.equal(out[5].teacher,'教師5');
 for(const list of [[...sections,{className:'c1',teacher:'重複教師'}],[...sections,{className:'C',teacher:'整班教師'}],[{className:'C0',teacher:'無效'}],[{className:'C1',teacher:' '}],[{className:'C1',teacher:'示例',lessons:0}]])assert.throws(()=>C.expandSectionAssignments({sections:list,lessons:2}));
});
test('older labels remain independent while explicit section links round-trip with plan and semester',()=>{
 const old=state({schemaVersion:11,unassignedBlocks:[lesson('old','A2')]});assert.equal(C.parentCls(old.unassignedBlocks[0]),C.cls(old.unassignedBlocks[0]));assert.equal(old.schemaVersion,12);
 const d=state({termInfo:{id:'u',academicYear:'2026/2027',semester:'上學期',finalized:false},unassignedBlocks:[section('a'),section('b','C2')]});assert.equal(C.parentCls(d.unassignedBlocks[0]),C.cls(lesson('x')));assert.equal(d.offeringPlan[0].targets[0].parentClassName,'C');const lower=C.createTerm(d,{id:'l',academicYear:'2026/2027',semester:'下學期'},C.defaults);assert.equal(C.switchTerm(C.validate(JSON.parse(JSON.stringify(lower))),'u').unassignedBlocks[1].parentClassName,'C');
 assert.throws(()=>state({unassignedBlocks:[section('bad','C1',{parentClassName:'D'})]}),/母班/);assert.throws(()=>state({offeringPlan:[{...d.offeringPlan[0],targets:[{className:'C2',parentClassName:'D',lessons:2}]}]}),/母班/);
});
test('only distinct sections of the same subject may overlap; parent classes block every section',()=>{
 const c1=section('one'),c2=section('two','C2'),mother=lesson('whole','C',{subjectCode:'BAE201'}),other=section('other','C2',{subjectCode:'GEF999'});
 assert.deepEqual(C.conflicts(slot(c1),slot(c2)),[]);assert.deepEqual(C.conflicts(slot(c1),slot(mother)),['班級撞堂']);assert.deepEqual(C.conflicts(slot(mother),slot(c2)),['班級撞堂']);assert.deepEqual(C.conflicts(slot(c1),slot(other)),['班級撞堂']);assert.deepEqual(C.conflicts(slot(c1),slot(section('same'))),['班級撞堂']);
 const d=state({timetable:[slot(c1)],unassignedBlocks:[c2,mother,other]});assert.equal(C.placement(d,'two',1,1).ok,true);assert.match(C.placement(d,'whole',1,1).message,/班級撞堂/);assert.match(C.placement(d,'other',1,1).message,/班級撞堂/);assert.equal(C.placement(d,'whole',1,2).ok,true);
});
test('sections still check rooms, teachers and both parent/section restrictions',()=>{
 const c1=section('one','C1',{room:'G1'}),c2=section('two','C2',{room:'G1'}),whole=lesson('whole');const d=state({timetable:[slot(c1)],unassignedBlocks:[c2],rules:[{id:'parent',kind:'class',target:C.cls(whole),cells:['2:2']},{id:'exact',kind:'class',target:C.cls(c2),cells:['3:3']}]});
 assert.match(C.placement(d,'two',1,1).message,/課室撞堂/);assert.match(C.placement(d,'two',2,2).message,/不符合排課限制/);assert.match(C.placement(d,'two',3,3).message,/不符合排課限制/);assert.equal(C.restrictions(d.rules,c1,3,3).length,0);
 d.unassignedBlocks[0].teacher=c1.teacher;assert.equal(C.placement(d,'two',1,1).needsMerge,true);assert.deepEqual(C.conflicts(slot(c1),slot(d.unassignedBlocks[0])),['教師撞堂','課室撞堂']);assert.equal(C.stats([],d.timetable,d.settings).length,0);
});
test('same-code section rows preserve their class labels and cannot cross-assign enrolment to another section or parent',()=>{
 const raw=(klass,count,teacher)=>({'科目總碼':'261BAECF2'+klass+'GEF00400','科目名稱':'大學英語 IV - GEF004-'+klass,'正選人數':count,'授課教師':teacher,'教室節次館別':'G2106 星期一 01/09:00-10:15'});
 const c1=section('a'),c2=section('b','C2');const d=state({timetable:[slot(c1),slot(c2,2)],unassignedBlocks:[lesson('whole')]});
 const parsed=E.aggregate([raw('C1',12,c1.teacher),raw('C2',17,c2.teacher)]);assert.deepEqual(parsed.groups.map(g=>[g.className,g.total,g.needsReview]),[['C1',12,undefined],['C2',17,undefined]]);const r=E.review(parsed,d);assert.ok(r.groups.every(g=>g.selected));
 for(const target of [c2,lesson('whole')]){const wrong=E.review(parsed,d);wrong.groups[0].targetKey=E.targetKey(target);assert.throws(()=>E.apply(d,wrong,{counts:true}),/細班與母班或其他細班/);}E.apply(d,r,{counts:true});assert.deepEqual(d.timetable.map(i=>i.block.headcount),[12,17]);assert.equal(d.unassignedBlocks[0].headcount,null);assert.deepEqual(C.scheduleRows(d).map(row=>row['班級']),['大二C1','大二C2']);
 const mismatch=E.aggregate([{...raw('C1',12,c1.teacher),'科目總碼':'261BAECF2C2GEF00400'}]);assert.equal(mismatch.groups[0].needsReview,true);
});
