/* FOF Scheduler v3 domain rules. No browser or network dependency. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FOFCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
// Faculty-confirmed abbreviations and English names; canonical codes keep existing exports stable.
const programmes=[
 {code:'BAECF',shortCode:'BAE',aliases:['BAE','BAECF'],name:'應用經濟學學士學位課程',label:'應用經濟學學士',englishName:'Bachelor of Applied Economics'},
 {code:'MFICF',shortCode:'MFI',aliases:['MFI','MFICF'],name:'金融學碩士學位課程',label:'金融學碩士',englishName:'Master of Finance'},
 {code:'MFTBF',shortCode:'MFT',aliases:['MFT','MFTBF'],name:'金融科技碩士學位課程',label:'金融科技碩士',englishName:'Master of FinTech'},
 {code:'DFICF',shortCode:'DFI',aliases:['DFI','DFICF'],name:'金融學博士學位課程',label:'金融學博士',englishName:'Doctor of Finance'}
];
function programmeInfo(value){const key=typeof value==='string'?value.trim().replace(/\s+/g,' ').toUpperCase():'';return programmes.find(p=>[p.name,p.label,p.englishName,...p.aliases].some(v=>v.toUpperCase()===key))||null;}
const defaults={weeks:15,academicMinutes:50,capacity:10,stage:'planning',semesterName:'未命名學期',startDate:'',endDate:''};
const slots=[{num:1,time:'09:00-10:15'},{num:2,time:'10:30-11:45'},{num:3,time:'12:00-13:15'},{num:4,time:'13:30-14:45'},{num:5,time:'15:00-16:15'},{num:6,time:'16:30-17:45'},{num:7,time:'19:00-20:15'},{num:8,time:'20:30-21:45'}];
const text=x=>typeof x==='string'?x.trim():'';
const round=n=>Math.round(n*100)/100;
const cls=b=>JSON.stringify([b.program,b.grade,b.className]);
const sameSubject=(a,b)=>text(a.subjectCode).toUpperCase()===text(b.subjectCode).toUpperCase()&&text(a.subject)===text(b.subject);
const sameMergeSubject=(a,b,exceptions=[])=>exceptions.some(r=>r.enabled&&r.codes.includes(text(a.subjectCode).toUpperCase())&&r.codes.includes(text(b.subjectCode).toUpperCase()))||(text(a.subjectCode)&&text(b.subjectCode)?text(a.subjectCode).toUpperCase()===text(b.subjectCode).toUpperCase():sameSubject(a,b));
const session=i=>i.mergeId?JSON.stringify(['merge',i.day,i.slot,i.mergeId]):JSON.stringify(['block',i.block.id]);
const clock=t=>{if(!/^\d\d:\d\d$/.test(t))throw Error('時間須為 HH:mm');const [h,m]=t.split(':').map(Number);if(h>24||m>59||(h===24&&m))throw Error('時間超出範圍');return h*60+m;};
const minutes=s=>{const [a,b]=s.time.split('-').map(clock);return b-a;};
const slotRange=n=>slots[n-1].time.split('-').map(clock);
function dateISO(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
const weekday=s=>new Date(s+'T00:00:00Z').getUTCDay()||7;
const nextDate=s=>new Date(new Date(s+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
const unique=(arr,name)=>{const ids=new Set();for(const a of arr){if(ids.has(a.id))throw Error(name+' ID重複');ids.add(a.id);}};
// Curriculum supplied by the faculty on 2026-10-27. Credits are editable general defaults.
const catalogRows=[
 ['BAE101','微積分導論','上學期'],['BAE103','微觀經濟學導論','上學期'],['BAE105','會計學導論I','上學期'],
 ['BAE202','量化分析','上學期'],['BAE203','中級微觀經濟學','上學期'],['BAE205','金融學原理','上學期'],['BAE208','管理學原理','上學期'],
 ['BAE301','計量經濟學導論','上學期'],['BAE303','金融經濟學導論','上學期'],['BAE305','公司金融','上學期','金融學方向'],['BAE307','投資學','上學期','金融學方向'],['BAE309','勞動經濟學','上學期','經濟學方向'],['BAE310','產業經濟學','上學期','經濟學方向'],
 ['BAE401','學術專題項目I','上學期'],['BAE404','研究報告I','上學期'],['BAE406','金融與經濟研究方法','上學期','金融學方向'],['BAE411','金融與經濟研究方法','上學期','經濟學方向'],['BAE407','實證方法與建模','上學期','金融學方向'],['BAE412','實證方法與建模','上學期','經濟學方向'],['BAE409','風險管理簡介','上學期','金融學方向'],['BAE413','經濟思想史','上學期','經濟學方向'],
 ['BAE102','線性代數導論','下學期'],['BAE104','宏觀經濟學導論','下學期'],['BAE106','會計學導論II','下學期'],['BAE201','企業數學與統計學','下學期'],['BAE204','中級宏觀經濟學','下學期'],['BAE206','金融市場簡介','下學期'],['BAE207','財務管理','下學期'],
 ['BAE302','時間序列分析','下學期'],['BAE304','國際金融','下學期'],['BAE306','衍生品證券','下學期','金融學方向'],['BAE308','固定收益證券','下學期','金融學方向'],['BAE311','發展經濟學','下學期','經濟學方向'],['BAE312','國際貿易','下學期','經濟學方向'],
 ['BAE402','學術專題項目II','下學期'],['BAE403','金融機構管理','下學期'],['BAE405','研究報告II','下學期'],['BAE408','金融前沿專題','下學期','金融學方向'],['BAE410','兼併與收購簡介','下學期','金融學方向'],['BAE414','當代中國經濟','下學期','經濟學方向'],['BAE415','博弈論導論','下學期','經濟學方向']
];
const seedCatalog=catalogRows.map(([code,name,term,direction])=>{const year=Number(code[3]);return {code,name,credits:3,courseType:direction?'選修':'必修',faculty:'金融學院',terms:[term],grades:[['','大一','大二','大三','大四'][year]],directions:direction?[direction]:year<3?['未分方向']:['金融學方向','經濟學方向'],assessment:'未設定',notes:''};});
// Fill blank defaults; also retire the exact v3.8 pending marker after faculty confirmation.
// Lessons and unrelated custom defaults are never rewritten.
const legacyBAE412Note='方向待確認：最新清單標為金融學，先前說明為經濟學；舊資料方向保留，請確認後編輯。';
function catalogPlan(catalog){
 const out=JSON.parse(JSON.stringify(catalog)),changes=[],preserved=[];
 for(const seed of seedCatalog){const c=out.find(c=>c.code===seed.code);if(!c){out.push(JSON.parse(JSON.stringify(seed)));changes.push({code:seed.code,name:seed.name,fields:['新增科目']});continue;}
  const fields=[];if(c.code==='BAE412'&&c.notes===legacyBAE412Note){c.notes='';fields.push('移除舊版待確認備註');if(JSON.stringify(c.directions)!==JSON.stringify(seed.directions)){c.directions=[...seed.directions];fields.push('已確認經濟學方向');}}for(const [key,label] of [['name','名稱'],['credits','學分'],['courseType','性質'],['faculty','單位'],['terms','學期'],['grades','年級'],['directions','方向'],['notes','備註']]){const empty=v=>v===undefined||v===null||v===''||Array.isArray(v)&&!v.length;if(empty(c[key])&&!empty(seed[key])){c[key]=JSON.parse(JSON.stringify(seed[key]));fields.push(label);}else if(!empty(seed[key])&&!empty(c[key])&&JSON.stringify(c[key])!==JSON.stringify(seed[key]))preserved.push({code:seed.code,field:label,value:Array.isArray(c[key])?c[key].join('、'):String(c[key])});}
  if(fields.length)changes.push({code:seed.code,name:c.name,fields});
 }
 return {catalog:out,changes,preserved};
}
const seedExceptions=[{id:'EX-BAE406-BAE411',codes:['BAE406','BAE411'],enabled:true,reason:'本學期特殊安排：金融學／經濟學方向，同教師同時段可確認併班'}];
function validate(raw){
 if(!raw||!Array.isArray(raw.unassignedBlocks)||!Array.isArray(raw.timetable))throw Error('備份必須包含待排課池及課表陣列');
 if(raw.schemaVersion!==undefined&&![2,3,4,5,6,7,8].includes(raw.schemaVersion))throw Error('不支援此備份版本');
 if(raw.unassignedBlocks.length+raw.timetable.length>10000)throw Error('課節上限為10000');
 if(raw.catalog!==undefined&&!Array.isArray(raw.catalog)||raw.mergeExceptions!==undefined&&!Array.isArray(raw.mergeExceptions))throw Error('科目資料庫及併班例外必須為陣列');
 const catalog=(raw.catalog===undefined?seedCatalog:raw.catalog).map(c=>{if(!c||!text(c.code)||!text(c.name)||text(c.code).length>50||text(c.name).length>300||!Array.isArray(c.terms)||c.terms.some(t=>!['上學期','下學期'].includes(t))||!Array.isArray(c.directions)||c.directions.some(t=>!['金融學方向','經濟學方向','未分方向'].includes(t))||c.credits!==null&&(!Number.isFinite(c.credits)||c.credits<0||c.credits>30)||!['','必修','選修'].includes(c.courseType)||!['未設定','開卷考試','閉卷考試','報告/論文'].includes(c.assessment)||typeof c.faculty!=='string'||c.faculty.length>100)throw Error('科目預設資料不正確');if(c.grades!==undefined&&(!Array.isArray(c.grades)||c.grades.some(g=>!['大一','大二','大三','大四','研一','研二','博一','博二','博三'].includes(g)))||c.notes!==undefined&&(typeof c.notes!=='string'||c.notes.length>1000))throw Error('科目年級或備註不正確');return {grades:[...new Set(c.grades||[])],notes:text(c.notes),code:text(c.code).toUpperCase(),name:text(c.name),credits:c.credits,courseType:c.courseType,faculty:text(c.faculty),terms:[...new Set(c.terms)],directions:[...new Set(c.directions)],assessment:c.assessment};});
 if(catalog.length>2000||new Set(catalog.map(c=>c.code)).size!==catalog.length)throw Error('科目編號重複或資料庫超過2000科');
 const mergeExceptions=(raw.mergeExceptions===undefined?seedExceptions:raw.mergeExceptions).map(r=>{if(!r||!text(r.id)||!Array.isArray(r.codes)||r.codes.length!==2||r.codes.some(c=>!text(c)||text(c).length>50)||typeof r.enabled!=='boolean'||typeof r.reason!=='string'||r.reason.length>1000)throw Error('跨編號併班例外不正確');const codes=r.codes.map(c=>text(c).toUpperCase()).sort();if(codes[0]===codes[1])throw Error('跨編號併班必須選擇兩個不同編號');return {id:text(r.id),codes,enabled:r.enabled,reason:text(r.reason)};});unique(mergeExceptions,'併班例外');if(mergeExceptions.length>100||new Set(mergeExceptions.map(r=>r.codes.join('|'))).size!==mergeExceptions.length)throw Error('併班例外重複或超過100對');
 const ids=new Set();
 function block(b){
  if(!b||!['id','program','grade','className','subject','teacher'].every(k=>typeof b[k]==='string'&&b[k].trim()&&b[k].length<=300))throw Error('課節缺少有效ID、課程、年級、班級、科目或教師');
  if(ids.has(b.id))throw Error('重複拼圖ID：'+b.id);ids.add(b.id);
  for(const k of ['subjectCode','room'])if(b[k]!==undefined&&typeof b[k]!=='string')throw Error('科目編號或課室格式不正確');
  if(b.locked!==undefined&&typeof b.locked!=='boolean')throw Error('鎖定狀態格式不正確');
  const headcount=b.headcount===undefined||b.headcount===null||b.headcount===''?null:Number(b.headcount);
  if(headcount!==null&&(!Number.isInteger(headcount)||headcount<0||headcount>10000))throw Error('班級人數須為0–10000，或留空');
  const assessment=b.assessment===undefined?'未設定':b.assessment;
  const courseType=b.courseType===undefined?'必修':b.courseType;
  const faculty=b.faculty===undefined?'金融學院':text(b.faculty);
  const credits=b.credits===undefined?3:Number(b.credits);
  if(!['未設定','開卷考試','閉卷考試','報告/論文'].includes(assessment)||!['必修','選修'].includes(courseType)||!faculty||faculty.length>100||b.credits===''||b.credits===null||b.credits!==undefined&&!['number','string'].includes(typeof b.credits)||!Number.isFinite(credits)||credits<0||credits>30)throw Error('考核形式、必修／選修、開課學院或學分不正確');
  let enrolment=null;
  if(b.enrolment!==undefined&&b.enrolment!==null){const e=b.enrolment;if(!Number.isInteger(e.base)||!Number.isInteger(e.cross)||e.base<0||e.cross<0||e.base+e.cross!==headcount||typeof e.term!=='string'||!Array.isArray(e.sourceIds)||e.sourceIds.some(x=>typeof x!=='string'||x.length>100))throw Error('選科人數明細不正確');enrolment={base:e.base,cross:e.cross,term:e.term,sourceIds:[...new Set(e.sourceIds)]};}
  return {enrolment,assessment,courseType,faculty,credits,id:b.id,program:text(b.program),grade:text(b.grade),className:text(b.className),subject:text(b.subject),subjectCode:text(b.subjectCode).toUpperCase(),teacher:text(b.teacher),room:text(b.room).toUpperCase(),locked:!!b.locked,headcount};
 }
 const unassignedBlocks=raw.unassignedBlocks.map(block);
 const timetable=raw.timetable.map(i=>{
  if(!i||!Number.isInteger(i.day)||i.day<1||i.day>7||!Number.isInteger(i.slot)||i.slot<1||i.slot>8)throw Error('排課星期或節次不正確');
  if(i.mergeId!==undefined&&(typeof i.mergeId!=='string'||!i.mergeId.trim()))throw Error('合班ID不正確');
  return {day:i.day,slot:i.slot,block:block(i.block),...(i.mergeId?{mergeId:i.mergeId}:{})};
 });
 const s={...defaults,...raw.settings};
 if(!Number.isInteger(s.weeks)||s.weeks<1||s.weeks>52||!Number.isFinite(s.academicMinutes)||s.academicMinutes<1||s.academicMinutes>120||!Number.isInteger(s.capacity)||s.capacity<1||s.capacity>1000)throw Error('教學週數、學時分鐘或課量提示線不正確');
 if((s.startDate||s.endDate)&&(!dateISO(s.startDate)||!dateISO(s.endDate)||s.startDate>s.endDate||(new Date(s.endDate)-new Date(s.startDate))/86400000>366))throw Error('請填寫有效學期起訖日期（最長366天）');
 if(!['planning','confirmed'].includes(s.stage))throw Error('排課階段不正確');
 const settings={stage:s.stage,weeks:s.weeks,academicMinutes:s.academicMinutes,capacity:s.capacity,semesterName:text(s.semesterName)||'未命名學期',startDate:s.startDate,endDate:s.endDate};
 for(const key of ['rooms','rules','holidays'])if(raw[key]!==undefined&&!Array.isArray(raw[key]))throw Error(key+'必須為陣列');
 const rooms=(raw.rooms||[]).map(r=>{if(!r||!text(r.name)||!Number.isInteger(r.capacity)||r.capacity<1||r.capacity>10000)throw Error('課室名稱及容量不正確');return {name:text(r.name).toUpperCase(),capacity:r.capacity};});
 if(new Set(rooms.map(r=>r.name)).size!==rooms.length)throw Error('課室名稱重複');
 const rules=(raw.rules||[]).map(r=>{
  if(!r||!text(r.id)||!['teacher','global','program','class','room'].includes(r.kind)||!Array.isArray(r.cells)||!r.cells.length||r.cells.some(c=>typeof c!=='string'||! /^[1-7]:[1-8]$/.test(c)))throw Error('排課限制格式不正確');
  const target=r.kind==='room'?text(r.target).toUpperCase():text(r.target);
  if(r.kind!=='global'&&!target)throw Error('限制對象不能留空');
  if(r.kind==='class'){let a;try{a=JSON.parse(target);}catch(e){}if(!Array.isArray(a)||a.length!==3||a.some(x=>typeof x!=='string'||!x.trim()))throw Error('班級限制對象格式不正確');}
  return {id:text(r.id),kind:r.kind,target,cells:[...new Set(r.cells)],reason:text(r.reason)};
 });unique(rules,'限制');
 const holidays=(raw.holidays||[]).map(h=>{
  if(!h||!text(h.id)||!dateISO(h.date)||!text(h.name))throw Error('假期日期或名稱不正確');
  const endDate=h.endDate===undefined?h.date:h.endDate;
  if(!dateISO(endDate)||endDate<h.date||(new Date(endDate)-new Date(h.date))/86400000>366)throw Error('假期結束日期須不早於開始日期，最長367個曆日');
  const start=h.start===undefined?0:h.start,end=h.end===undefined?1440:h.end;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||start>=end)throw Error('假期時段不正確');
  if(h.enabled!==undefined&&typeof h.enabled!=='boolean')throw Error('假期啟用狀態不正確');
  return {id:text(h.id),date:h.date,endDate,name:text(h.name),start,end,enabled:h.enabled!==false,source:text(h.source)};
 });unique(holidays,'假期');
 if(holidays.length>2000||rules.length>1000||rooms.length>1000)throw Error('設定數量過多');
 const followups=Object.create(null);for(const [key,v] of Object.entries(raw.followups||{})){if(!v||!['pending','planned','exempt'].includes(v.status)||typeof v.note!=='string')throw Error('假期跟進資料不正確');followups[key]={status:v.status,note:v.note.slice(0,2000)};}
 const groups=new Map();timetable.filter(i=>i.mergeId).forEach(i=>{if(!groups.has(i.mergeId))groups.set(i.mergeId,[]);groups.get(i.mergeId).push(i);});
 for(const group of groups.values())if(group.some(i=>i.day!==group[0].day||i.slot!==group[0].slot||i.block.teacher!==group[0].block.teacher||!sameMergeSubject(i.block,group[0].block,mergeExceptions)||i.block.room!==group[0].block.room)||new Set(group.map(i=>cls(i.block))).size!==group.length||group.some((i,n)=>group.slice(n+1).some(j=>!sameMergeSubject(i.block,j.block,mergeExceptions))))throw Error('併班須同教師、同時段、共用課室及不同班級；跨編號須有啟用例外，停用例外前請先拆班');
 const subjectForms=new Map();for(const b of [...unassignedBlocks,...timetable.map(i=>i.block)]){const key=assessmentKey(b);if(!subjectForms.has(key))subjectForms.set(key,new Set());if(b.assessment!=='未設定')subjectForms.get(key).add(b.assessment);}for(const b of [...unassignedBlocks,...timetable.map(i=>i.block)]){const forms=subjectForms.get(assessmentKey(b));if(b.assessment==='未設定'&&forms.size===1)b.assessment=[...forms][0];}
 return {schemaVersion:8,catalog,mergeExceptions,unassignedBlocks,timetable,settings,rooms,rules,holidays,followups};
}
function matchesRule(rule,b){return rule.kind==='global'||rule.kind==='teacher'&&rule.target===b.teacher||rule.kind==='room'&&rule.target===b.room||rule.kind==='program'&&rule.target===b.program||rule.kind==='class'&&rule.target===cls(b);}
const restrictions=(rules,b,day,slot)=>rules.filter(r=>matchesRule(r,b)&&r.cells.includes(day+':'+slot));
function conflicts(a,b,exceptions=[]){if(a.day!==b.day||a.slot!==b.slot)return [];const out=[];const merge=a.mergeId&&a.mergeId===b.mergeId&&sameMergeSubject(a.block,b.block,exceptions)&&a.block.teacher===b.block.teacher&&a.block.room===b.block.room;if(cls(a.block)===cls(b.block))out.push('班級撞堂');if(a.block.teacher===b.block.teacher&&!merge)out.push('教師撞堂');if(a.block.room&&a.block.room===b.block.room&&!merge)out.push('課室撞堂');return out;}
function audit(timetable,exceptions=[]){const out=[];const groups=new Map();for(const i of timetable){const k=i.day+':'+i.slot;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}for(const items of groups.values())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){const types=conflicts(items[a],items[b],exceptions);if(types.length)out.push({a:items[a],b:items[b],types});}return out;}

// A subject code owns one assessment across programmes, years and classes.
const assessmentKey=b=>text(b.subjectCode)?'code:'+text(b.subjectCode).toUpperCase():'name:'+JSON.stringify([b.program,text(b.subject)]);
function subjectAssessments(data,b){return [...new Set([...data.unassignedBlocks,...data.timetable.map(i=>i.block)].filter(x=>assessmentKey(x)===assessmentKey(b)).map(x=>x.assessment).filter(x=>x&&x!=='未設定'))];}
function setSubjectAssessment(data,b,assessment){
 if(!['未設定','開卷考試','閉卷考試','報告/論文'].includes(assessment))throw Error('考核形式不正確');
 for(const x of [...data.unassignedBlocks,...data.timetable.map(i=>i.block)])if(assessmentKey(x)===assessmentKey(b)){
  if(x.locked&&x.assessment!==assessment)throw Error('同科目有鎖定課節，請先解鎖再統一考核形式');x.assessment=assessment;
 }
 const c=data.catalog?.find(c=>c.code===text(b.subjectCode).toUpperCase());if(c)c.assessment=assessment;
}

const isFOF=b=>!b.faculty||['金融學院','FOF'].includes(b.faculty);
const isExam=b=>['開卷考試','閉卷考試'].includes(b.assessment);
const teachingWeeks=(b,settings)=>Math.min(settings.weeks,isExam(b)?14:b.assessment==='報告/論文'?15:settings.weeks);
function teachingPeriod(b,settings){
 const weeks=teachingWeeks(b,settings),start=settings.startDate||'';
 const end=settings.endDate?new Date(new Date(settings.endDate+'T00:00:00Z').getTime()-(settings.weeks-weeks)*7*86400000).toISOString().slice(0,10):'';
 return {start,end:start&&end<start?'':end,weeks};
}
function scheduleRows(data){
 const groups=new Map();
 for(const i of data.timetable){const b=i.block,p=teachingPeriod(b,data.settings);
  const key=JSON.stringify([b.subjectCode,b.subject,b.credits??3,b.courseType||'必修',cls(b),b.teacher,b.room,b.assessment,b.faculty,p.start,p.end]);
  if(!groups.has(key))groups.set(key,{b,p,days:new Map()});const g=groups.get(key);if(!g.days.has(i.day))g.days.set(i.day,new Set());g.days.get(i.day).add(i.slot);
 }
 const out=[],names=['','星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
 for(const {b,p,days} of groups.values()){
  const combinations=new Map();for(const [day,set] of [...days].sort((a,b)=>a[0]-b[0])){const times=[...set].sort((a,b)=>a-b).map(n=>slots[n-1].time).join('; ');if(!combinations.has(times))combinations.set(times,[]);combinations.get(times).push(names[day]);}
  for(const [times,ds] of combinations)out.push({'科目編號':b.subjectCode,'科目名':b.subject,'學分':b.credits??3,'必修/選修':b.courseType||'必修','班級':b.grade+b.className,'星期':ds.join('、'),'時間':times,'課室':b.room,'上課期間':p.start&&p.end?p.start.replaceAll('-','.')+'-'+p.end.replaceAll('-','.'):'未設定學期日期'});
 }
 return out;
}
const roomCollator=new Intl.Collator('zh-Hant',{numeric:true,sensitivity:'base'});
const compareRooms=(a,b)=>roomCollator.compare(text(a).toUpperCase().replace(/^GDC-/,''),text(b).toUpperCase().replace(/^GDC-/,''))||roomCollator.compare(a,b);
const sortRoomNames=names=>[...new Set(names.filter(Boolean))].sort(compareRooms);
function distribution(timetable,{includeSunday=false,scope='all'}={}){
 const days=includeSunday?7:6,cells=[],map=new Map();for(let day=1;day<=days;day++)for(const s of slots){const c={day,slot:s.num,classes:0,people:0,unknownPeople:0,keys:new Set()};cells.push(c);map.set(day+':'+s.num,c);}
 const outside=new Set();for(const i of timetable){if(scope==='fof'&&!isFOF(i.block))continue;const c=map.get(i.day+':'+i.slot);if(!c){outside.add(session(i));continue;}c.classes++;c.keys.add(session(i));if(i.block.headcount===null||i.block.headcount===undefined)c.unknownPeople++;else c.people+=i.block.headcount;}
 const totalSessions=cells.reduce((n,c)=>n+c.keys.size,0),slotCount=cells.length,average=totalSessions/slotCount;
 const result=cells.map(c=>{const sessions=c.keys.size,share=totalSessions?sessions/totalSessions*100:0,multiple=average?sessions/average:0;const tone=!sessions?'empty':sessions>=2&&multiple>=2?'danger':sessions>=2&&multiple>=1.5?'warn':'healthy';return {day:c.day,slot:c.slot,classes:c.classes,people:c.people,unknownPeople:c.unknownPeople,sessions,share,multiple,tone,label:tone==='danger'?'高度集中':tone==='warn'?'偏集中':tone==='empty'?'沒有課堂':'一般'};});
 return {days,scope,cells:result,totalSessions,slotCount,average,expectedShare:100/slotCount,outsideSessions:outside.size,peak:Math.max(0,...result.map(c=>c.sessions))};
}
function roomPressure(data,day,slot){
 const items=data.timetable.filter(i=>isFOF(i.block)&&i.day===day&&i.slot===slot);
 const names=sortRoomNames([...data.rooms.map(r=>r.name),...items.map(i=>i.block.room)]);
 return names.map(name=>{const list=items.filter(i=>i.block.room===name),room=data.rooms.find(r=>r.name===name),seats=list.reduce((sum,i)=>sum+(i.block.headcount||0),0),unknown=list.filter(i=>i.block.headcount===null||i.block.headcount===undefined).length;const sessions=new Set(list.map(session)).size;
  const blocked=restrictions(data.rules,{room:name},day,slot).length>0;
  return {name,capacity:room?room.capacity:null,seats,unknown,sessions,blocked,over:!!room&&seats>room.capacity,conflict:sessions>1,ratio:room?seats/room.capacity:null};
 });
}
function slotLoad(timetable,day,slot){const items=timetable.filter(i=>isFOF(i.block)&&i.day===day&&i.slot===slot);return {classes:items.length,sessions:new Set(items.map(session)).size,rooms:new Set(items.map(i=>i.block.room).filter(Boolean)).size,missingRooms:items.filter(i=>!i.block.room).length};}
function pressure(data,day,slot){const rows=roomPressure(data,day,slot),load=slotLoad(data.timetable,day,slot);const available=rows.filter(r=>r.capacity!==null&&!r.blocked);return {...load,rows,availableRooms:available.length,occupiedRooms:available.filter(r=>r.sessions>0).length,totalSeats:available.reduce((s,r)=>s+r.capacity,0),overRooms:rows.filter(r=>r.over).length,unknownClasses:data.timetable.filter(i=>isFOF(i.block)&&i.day===day&&i.slot===slot&&(i.block.headcount===null||i.block.headcount===undefined)).length,unregistered:rows.filter(r=>r.sessions&&!r.capacity).length,conflictRooms:rows.filter(r=>r.conflict||r.blocked&&r.sessions).length};}
function placement(data,blockId,day,slot,options={}){
 const original=data.timetable.find(i=>i.block.id===blockId),b=original?original.block:data.unassignedBlocks.find(b=>b.id===blockId);
 const fail=message=>({ok:false,message});if(!b)return fail('找不到課節');if(b.locked)return fail('此課節已鎖定');if(!Number.isInteger(day)||day<1||day>7||!Number.isInteger(slot)||slot<1||slot>8)return fail('無效時段');
 if(original&&original.day===day&&original.slot===slot)return {ok:true,noChange:true};
 if(original&&original.mergeId)return fail('合班課請先移回待排池，再重新安排');
 const limits=restrictions(data.rules,b,day,slot).filter(r=>r.kind!=='room');if(limits.length)return fail('不符合排課限制：'+limits.map(r=>r.reason||r.target||'全院禁排').join('；'));
 const others=data.timetable.filter(i=>i!==original&&i.day===day&&i.slot===slot);
 if(others.some(i=>cls(i.block)===cls(b)))return fail('班級撞堂');
 const merge=others.filter(i=>i.block.teacher===b.teacher);
 if(merge.some(i=>!sameMergeSubject(i.block,b,data.mergeExceptions||[])))return fail('教師撞堂：同一時段已有不同科目');
 if(new Set(merge.map(i=>i.mergeId||i.block.id)).size>1)return fail('教師已有未解決衝突');
 if(merge.some(i=>i.block.locked))return fail('合班對象已鎖定，請先解鎖');
 const roomChoices=sortRoomNames([b.room,...merge.map(i=>i.block.room)]),explicit=Object.prototype.hasOwnProperty.call(options,'mergeRoom');
 const proposedRoom=roomChoices.length===1?roomChoices[0]:'';
 const meta={needsMerge:merge.length>0,mergeIds:merge.map(i=>i.block.id),roomChoices,proposedRoom,requiresRoomChoice:merge.length>0&&roomChoices.length>1&&!explicit};
 if(meta.requiresRoomChoice)return {ok:true,...meta};
 const roomName=merge.length?(explicit?text(options.mergeRoom).toUpperCase():proposedRoom):b.room;
 const mergeFail=message=>({...fail(message),...meta});
 if(merge.length&&roomChoices.length>1&&!roomName)return mergeFail('請先選擇併班共用課室');
 for(const x of [b,...merge.map(i=>i.block)]){if(restrictions(data.rules,{...x,room:roomName},day,slot).length)return mergeFail(merge.length?'併班共用課室或班級違反禁排限制':'不符合排課限制：課室不可用');}
 if(roomName&&others.some(i=>i.block.room===roomName&&!merge.includes(i)))return mergeFail('課室撞堂');
 const room=data.rooms.find(r=>r.name===roomName),sum=(b.headcount||0)+merge.reduce((s,i)=>s+(i.block.headcount||0),0);
 if(isFOF(b)&&room&&sum>room.capacity)return mergeFail(`課室容量不足：${roomName} 已知人數${sum}，容量${room.capacity}`);
 return {ok:true,...meta,mergeRoom:roomName};
}
function stats(pool,timetable,settings,timeSlots=slots){
 const map=new Map(),get=t=>{if(!map.has(t))map.set(t,{name:t,classes:new Set(),scheduled:0,pending:0,weightedMinutes:0,pendingMinutes:0,physical:new Set()});return map.get(t);};
 const label=b=>`${b.program} ${b.grade}${b.className} ${b.subjectCode} ${b.subject} · ${b.assessment||'未設定'} · 常規${teachingWeeks(b,settings)}週／核算${settings.weeks}週`;
 pool.filter(isFOF).forEach(b=>{const s=get(b.teacher);s.classes.add(label(b));s.pending++;s.pendingMinutes+=75*settings.weeks;});
 timetable.filter(i=>isFOF(i.block)).forEach(i=>{const s=get(i.block.teacher);s.classes.add(label(i.block));s.scheduled++;s.weightedMinutes+=minutes(timeSlots.find(s=>s.num===i.slot))*settings.weeks;s.physical.add(session(i));});
 return [...map.values()].map(s=>({name:s.name,classes:[...s.classes].sort(),scheduled:s.scheduled,pending:s.pending,physical:s.physical.size,clockHours:round(s.weightedMinutes/60),numerator:round(s.weightedMinutes/settings.academicMinutes),denominator:round((s.weightedMinutes+s.pendingMinutes)/settings.academicMinutes)})).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
}
function holidayImpacts(data){
 if(!data.settings.startDate||!data.settings.endDate)return [];
 const map=new Map();
 for(const h of data.holidays.filter(h=>h.enabled)){
  const from=h.date>data.settings.startDate?h.date:data.settings.startDate;
  const endDate=h.endDate||h.date,to=endDate<data.settings.endDate?endDate:data.settings.endDate;
  for(let date=from;date<=to;date=nextDate(date))for(const i of data.timetable){
   const period=teachingPeriod(i.block,data.settings);if(!period.end||date>period.end)continue;
   const [start,end]=slotRange(i.slot);if(i.day!==weekday(date)||start>=h.end||end<=h.start)continue;
   const key=date+'|'+i.block.id;if(!map.has(key))map.set(key,{key,date,item:i,names:[],status:data.followups[key]?.status||'pending',note:data.followups[key]?.note||''});
   const row=map.get(key);if(!row.names.includes(h.name))row.names.push(h.name);
  }
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.item.slot-b.item.slot||a.item.block.className.localeCompare(b.item.block.className));
}
function fullAudit(data){const issues=audit(data.timetable,data.mergeExceptions).map(x=>({type:x.types.join('／'),item:x.a,detail:`${x.a.block.subject} ↔ ${x.b.block.subject}（${x.b.block.teacher}）`}));for(const i of data.timetable){const rs=restrictions(data.rules,i.block,i.day,i.slot);if(rs.length)issues.push({type:'排課限制',item:i,detail:rs.map(r=>r.reason||r.target||'全院禁排').join('；')});}for(let day=1;day<=7;day++)for(let slot=1;slot<=8;slot++)for(const r of roomPressure(data,day,slot).filter(r=>r.over))issues.push({type:'課室超容量',item:data.timetable.find(i=>i.day===day&&i.slot===slot&&i.block.room===r.name),detail:`${r.name} 已知人數${r.seats} / ${r.capacity}${r.unknown?'（另有人數未填）':''}`});return issues;}
function parseCSV(input){const rows=[];let row=[],cell='',quoted=false;input=input.replace(/^\uFEFF/,'');for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==','){if(c==='\r'&&input[i+1]==='\n')i++;if(row.some(x=>x.trim()))rows.push(row);row=[];}}else cell+=c;}if(quoted)throw Error('CSV引號未關閉');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;}
function parseHolidayCSV(input,csv){const parsed=csv?csv.parse(input.replace(/^\uFEFF/,''),{skipEmptyLines:'greedy',dynamicTyping:false}):null;if(parsed?.errors.length)throw Error('CSV格式錯誤：'+parsed.errors[0].message);const rows=parsed?parsed.data:parseCSV(input);if(!rows.length)throw Error('CSV沒有資料');const head=rows.shift().map(s=>s.trim().toLowerCase());if(new Set(head).size!==head.length)throw Error('CSV欄名不能重複');if(!rows.length)throw Error('CSV沒有假期資料');if(rows.some(r=>r.length!==head.length))throw Error('CSV每列欄位數須與標題一致');const col=(name,r)=>r[head.indexOf(name)]?.trim()||'';if(!head.includes('date')||!head.includes('name'))throw Error('CSV須包含 date,name 欄位');return rows.map((r,n)=>({id:'csv-'+n+'-'+col('date',r),date:col('date',r),endDate:col('end_date',r)||col('date',r),name:col('name',r),start:col('start',r)?clock(col('start',r)):0,end:col('end',r)?clock(col('end',r)):1440,enabled:!['false','0'].includes(col('enabled',r).toLowerCase()),source:'CSV匯入'}));}
function parseICS(input){
 const lines=input.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);let event=null;const events=[];
 for(const line of lines){if(line==='BEGIN:VEVENT'){event=[];}else if(line==='END:VEVENT'){if(event)events.push(event);event=null;}else if(event)event.push(line);}
 if(!events.length)throw Error('ICS沒有VEVENT');
 const result=[];
 for(const [idx,event] of events.entries()){
  if(event.some(l=>/^(RRULE|RDATE|EXDATE|RECURRENCE-ID)[;:]/.test(l)))throw Error('暫不支援循環／例外日期ICS，請先轉成逐日CSV');
  const get=k=>event.find(l=>l.startsWith(k+':')||l.startsWith(k+';'));
  if(get('STATUS')==='STATUS:CANCELLED')continue;
  const start=get('DTSTART'),end=get('DTEND'),summary=get('SUMMARY');if(!start||!summary)throw Error('ICS事件缺少日期或名稱');
  const name=summary.slice(summary.indexOf(':')+1).replace(/\\[nN]/g,' ').replace(/\\([,;\\])/g,'$1');
  const parse=line=>{const k=line.slice(0,line.indexOf(':')),v=line.slice(line.indexOf(':')+1);if(/^\d{8}$/.test(v)){const date=v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8);if(!dateISO(date))throw Error('ICS日期無效');return {date,time:0,allDay:true};}
   if(!/^\d{8}T\d{6}Z?$/.test(v))throw Error('ICS時間格式不支援');const zone=k.match(/TZID=([^;]+)/)?.[1];if(zone&&!['Asia/Macau','Asia/Hong_Kong','Asia/Taipei','Asia/Shanghai'].includes(zone))throw Error('ICS只支援澳門／香港／台北／上海時區或UTC');
   let date=v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8),time=clock(v.slice(9,11)+':'+v.slice(11,13));if(!dateISO(date)||v.slice(13,15)!=='00')throw Error('ICS日期或秒數不支援');if(v.endsWith('Z')){time+=480;if(time>=1440){date=nextDate(date);time-=1440;}}return {date,time,allDay:false};};
  const a=parse(start),b=end?parse(end):a.allDay?{date:nextDate(a.date),time:0,allDay:true}:null;if(!b)throw Error('有時間的ICS須包含DTEND');
  if(a.allDay!==b.allDay||a.date>b.date||a.date===b.date&&a.time>=b.time||(new Date(b.date)-new Date(a.date))/86400000>366)throw Error('ICS結束時間不正確或期間過長');
  for(let d=a.date;d<=b.date;d=nextDate(d)){const from=d===a.date?a.time:0,to=d===b.date?b.time:1440;if(from<to)result.push({id:`ics-${idx}-${d}`,date:d,name,start:from,end:to,enabled:true,source:'ICS匯入（UTC+8）'});if(result.length>2000)throw Error('ICS超過2000天');}
 }
 return result;
}
// Soft preferences inspired by Timefold's school-timetabling examples; no solver code copied.
function suggestions(data,blockId,mode='balanced',weekends=false){
 const old=data.timetable.find(i=>i.block.id===blockId),b=old?old.block:data.unassignedBlocks.find(b=>b.id===blockId);if(!b||b.locked)return [];
 const teacherItems=data.timetable.filter(i=>i.block.id!==blockId&&i.block.teacher===b.teacher);
 const teacherDays=new Set(teacherItems.map(i=>i.day)),out=[];
 for(let day=1;day<=(weekends?7:5);day++)for(let slot=1;slot<=8;slot++){
  const plan=placement(data,blockId,day,slot);if(!plan.ok||plan.noChange)continue;
  const sameDay=teacherItems.filter(i=>i.day===day),positions=[...new Set([...sameDay.map(i=>i.slot),slot])].sort((a,b)=>a-b);
  const gaps=positions.length?positions.at(-1)-positions[0]+1-positions.length:0;
  const newDay=teacherDays.size&&!teacherDays.has(day)?1:0;
  const load=slotLoad(data.timetable.filter(i=>i.block.id!==blockId),day,slot).sessions;
  const repeated=data.timetable.some(i=>i.block.id!==blockId&&i.day===day&&cls(i.block)===cls(b)&&sameSubject(i.block,b));
  const score=mode==='compact'?newDay*25+gaps*12+load*2+(repeated?6:0):load*10+newDay*3+gaps*2+(repeated?8:0);
  const reasons=[`該時段原有${load}個課堂`];if(sameDay.length)reasons.push(gaps?`教師當日${gaps}個空堂節次`:'教師當日課節較集中');if(plan.needsMerge)reasons.push('須另確認合班');if(!b.room||!data.rooms.some(r=>r.name===b.room)||b.headcount===null)reasons.push('容量資料未齊，須核實');
  out.push({day,slot,score:score-(plan.needsMerge?4:0),needsMerge:plan.needsMerge,reasons});
 }
 return out.sort((a,b)=>a.score-b.score||a.day-b.day||a.slot-b.slot).slice(0,8);
}
return {programmes,programmeInfo,catalogPlan,distribution,compareRooms,sortRoomNames,assessmentKey,subjectAssessments,setSubjectAssessment,isFOF,teachingWeeks,teachingPeriod,scheduleRows,defaults,slots,validate,conflicts,audit,fullAudit,slotLoad,roomPressure,pressure,stats,placement,suggestions,restrictions,holidayImpacts,parseHolidayCSV,parseICS,sameSubject,cls,session,minutes,clock,dateISO,weekday,round};
});
