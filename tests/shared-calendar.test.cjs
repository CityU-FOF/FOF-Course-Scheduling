const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../scheduler-core.js'),official=require('../holiday-data.js');
const info=(id,semester='上學期',academicYear='2026/2027',finalized=false)=>({id,semester,academicYear,finalized});
const state=(id,startDate,endDate,extra={})=>C.validate({unassignedBlocks:[],timetable:[],termInfo:info(id),settings:{...C.defaults,startDate,endDate},...extra});
const holiday=(id,date,endDate=date,extra={})=>({id,date,endDate,name:'校曆假期',start:0,end:1440,enabled:true,source:'測試校曆',academicYear:'',semester:'',...extra});

test('offline public holidays seed once and each semester gets only dates inside its own range',()=>{
 let d=C.ensureOfficialCalendar(state('upper','2026-08-24','2026-12-04'),official);assert.equal(d.schemaVersion,10);assert.equal(d.holidayCalendar.length,40);assert.deepEqual(d.holidays.map(h=>h.date),['2026-09-26','2026-10-01','2026-10-02','2026-10-18','2026-11-02']);assert.deepEqual(d.officialCalendarYears,[2026,2027]);
 d=C.createTerm(d,info('lower','下學期'),{...C.defaults,startDate:'2027-02-15',endDate:'2027-06-01'});assert.deepEqual(d.holidays.map(h=>h.date),['2027-03-26','2027-03-27','2027-04-05','2027-05-01','2027-05-13']);assert.equal(d.holidayCalendar.length,40);assert.equal(C.ensureOfficialCalendar(d,official).holidayCalendar.length,40);
});

test('one winter range is shared and clipped independently across upper and lower semesters',()=>{
 const range=holiday('winter','2026-12-20','2027-02-15',{academicYear:'2026/2027'});let d=state('upper','2026-11-01','2027-01-15',{holidayCalendar:[range]});assert.deepEqual([d.holidays[0].date,d.holidays[0].endDate],['2026-12-20','2027-01-15']);d=C.createTerm(d,info('lower','下學期'),{...C.defaults,startDate:'2027-01-16',endDate:'2027-05-15'});assert.deepEqual([d.holidays[0].date,d.holidays[0].endDate],['2027-01-16','2027-02-15']);assert.equal(d.holidayCalendar.length,1);assert.equal(d.archives[0].holidays[0].id,'winter');assert.equal(d.holidays[0].id,'winter');assert.equal(d.holidayCalendar[0].date,'2026-12-20');
});

test('calendar date overlap and optional semester/year restrictions must all match',()=>{
 const day='2027-01-01';let d=state('upper','2026-12-01','2027-01-31',{holidayCalendar:[holiday('all',day),holiday('lower',day,day,{name:'只限下學期',semester:'下學期'}),holiday('other',day,day,{name:'其他學年',academicYear:'2027/2028'})]});assert.deepEqual(d.holidays.map(h=>h.id),['all']);d=C.createTerm(d,info('lower','下學期'),{...C.defaults,startDate:'2027-01-01',endDate:'2027-06-01'});assert.deepEqual(d.holidays.map(h=>h.id),['all','lower']);d.settings.startDate='';d.settings.endDate='';d=C.validate(d);assert.deepEqual(d.holidays,[]);assert.equal(d.holidayCalendar.length,3);
});

test('legacy semester-local disabled choices migrate without losing shared dates or frozen history',()=>{
 const off=holiday('same','2026-11-02',undefined,{enabled:false});const on={...off,enabled:true};const old=state('upper','2026-11-01','2026-11-10');delete old.holidayCalendar;delete old.officialCalendarYears;old.schemaVersion=9;old.holidays=[off];const lower=C.termSnapshot(state('lower','2026-11-01','2026-11-10',{termInfo:info('lower','下學期')}));lower.holidays=[on];const frozen=C.termSnapshot(state('old','2025-11-01','2025-11-10',{termInfo:info('old','上學期','2025/2026',true)}));frozen.holidays=[holiday('same','2025-11-02')];frozen.followups={'old-note':{status:'planned',note:'歷史補課備註'}};old.archives=[lower,frozen];const d=C.validate(old);assert.equal(d.holidayCalendar.length,2);assert.equal(d.holidays[0].enabled,false);assert.ok(d.excludedHolidays.includes('same'));assert.equal(d.archives[0].holidays[0].enabled,true);assert.deepEqual(d.archives[1].holidays,frozen.holidays.map(({academicYear,semester,...h})=>h));assert.equal(d.archives[1].followups['old-note'].note,'歷史補課備註');
});

test('shared calendar edits update open terms while finalized snapshots and follow-up notes stay unchanged',()=>{
 const day=holiday('h','2026-11-02');let d=state('upper','2026-11-01','2026-11-10',{holidayCalendar:[day],followups:{keep:{status:'planned',note:'保留'}}});const lower=C.termSnapshot(state('lower','2026-11-01','2026-11-10',{termInfo:info('lower','下學期'),holidayCalendar:[day]}));const frozen=C.termSnapshot(state('past','2025-11-01','2025-11-10',{termInfo:info('past','上學期','2025/2026',true)}));frozen.holidays=[holiday('frozen','2025-11-02')];d=C.validate({...d,archives:[lower,frozen]});const original=JSON.stringify(d.archives[1].holidays);d.holidayCalendar[0].date='2026-11-05';d.holidayCalendar[0].endDate='2026-11-05';d=C.validate(d);assert.equal(d.holidays[0].date,'2026-11-05');assert.equal(d.archives[0].holidays[0].date,'2026-11-05');assert.equal(JSON.stringify(d.archives[1].holidays),original);assert.equal(d.followups.keep.note,'保留');d.holidayCalendar=[];d=C.validate(d);assert.equal(d.holidays.length,0);assert.equal(d.archives[0].holidays.length,0);assert.equal(JSON.stringify(d.archives[1].holidays),original);
});

test('term exclusions stay local and deleting official entries does not silently recreate them next load',()=>{
 let d=C.ensureOfficialCalendar(state('upper','2026-11-01','2026-11-10'),official);const id=d.holidays[0].id;d.excludedHolidays=[id];d=C.validate(d);assert.equal(d.holidays[0].enabled,false);let other=C.createTerm(d,info('lower','下學期'),{...C.defaults,startDate:'2026-11-01',endDate:'2026-11-10'});assert.equal(other.holidays[0].enabled,true);other.holidayCalendar=other.holidayCalendar.filter(h=>h.id!==id);other=C.ensureOfficialCalendar(C.validate(other),official);assert.ok(!other.holidayCalendar.some(h=>h.id===id));assert.equal(other.holidays.length,0);
});

test('calendar metadata roundtrips, imports remap colliding IDs and retain exclusions',()=>{
 const current=state('upper','2026-11-01','2026-11-10',{holidayCalendar:[holiday('shared-id','2026-11-05')]}),incoming=state('source','2025-11-01','2025-11-10',{termInfo:info('source','下學期','2025/2026'),holidayCalendar:[holiday('shared-id','2025-11-02')],excludedHolidays:['shared-id']});const d=C.importTerm(current,incoming,'imported');assert.equal(d.holidayCalendar.length,2);const imported=d.archives[0],mapped=imported.excludedHolidays[0];assert.notEqual(mapped,'shared-id');assert.equal(imported.holidays[0].id,mapped);assert.equal(imported.holidays[0].enabled,false);assert.deepEqual(C.validate(JSON.parse(JSON.stringify(d))),d);
});

test('scope columns remain optional for old CSV but validate new year/semester values and duplicates',()=>{
 const old=C.normalizeCalendar(C.parseHolidayCSV('date,name\n2027-01-01,元旦'));assert.equal(old[0].academicYear,'');const scoped=C.normalizeCalendar(C.parseHolidayCSV('date,end_date,name,academic_year,semester\n2027-01-10,2027-01-20,寒假,2026/2027,上學期'));assert.equal(scoped[0].semester,'上學期');assert.equal(scoped[0].academicYear,'2026/2027');for(const extra of [{academicYear:'2026/2028'},{semester:'第一學期'}])assert.throws(()=>C.normalizeCalendar([{...holiday('h','2026-11-02'),...extra}]),/學年|學期/);assert.throws(()=>C.normalizeCalendar([holiday('a','2026-11-02'),holiday('b','2026-11-02')]),/重複/);assert.throws(()=>C.validate({...state('s','2026-11-01','2026-11-10'),excludedHolidays:'bad'}),/略過/);
});
