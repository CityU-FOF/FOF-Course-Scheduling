/* FOF Scheduler v3 domain rules. No browser or network dependency. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FOFCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const defaults={weeks:15,academicMinutes:50,capacity:10,semesterName:'未命名學期',startDate:'',endDate:''};
const slots=[{num:1,time:'09:00-10:15'},{num:2,time:'10:30-11:45'},{num:3,time:'12:00-13:15'},{num:4,time:'13:30-14:45'},{num:5,time:'15:00-16:15'},{num:6,time:'16:30-17:45'},{num:7,time:'19:00-20:15'},{num:8,time:'20:30-21:45'}];
const text=x=>typeof x==='string'?x.trim():'';
const round=n=>Math.round(n*100)/100;
const cls=b=>JSON.stringify([b.program,b.grade,b.className]);
const sameSubject=(a,b)=>text(a.subjectCode).toUpperCase()===text(b.subjectCode).toUpperCase()&&text(a.subject)===text(b.subject);
const session=i=>i.mergeId?JSON.stringify(['merge',i.day,i.slot,i.mergeId]):JSON.stringify(['block',i.block.id]);
const clock=t=>{if(!/^\d\d:\d\d$/.test(t))throw Error('時間須為 HH:mm');const [h,m]=t.split(':').map(Number);if(h>24||m>59||(h===24&&m))throw Error('時間超出範圍');return h*60+m;};
const minutes=s=>{const [a,b]=s.time.split('-').map(clock);return b-a;};
const slotRange=n=>slots[n-1].time.split('-').map(clock);
function dateISO(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
const weekday=s=>new Date(s+'T00:00:00Z').getUTCDay()||7;
const nextDate=s=>new Date(new Date(s+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
const unique=(arr,name)=>{const ids=new Set();for(const a of arr){if(ids.has(a.id))throw Error(name+' ID重複');ids.add(a.id);}};
function validate(raw){
 if(!raw||!Array.isArray(raw.unassignedBlocks)||!Array.isArray(raw.timetable))throw Error('備份必須包含待排課池及課表陣列');
 if(raw.schemaVersion!==undefined&&![2,3,4].includes(raw.schemaVersion))throw Error('不支援此備份版本');
 if(raw.unassignedBlocks.length+raw.timetable.length>10000)throw Error('課節上限為10000');
 const ids=new Set();
 function block(b){
  if(!b||!['id','program','grade','className','subject','teacher'].every(k=>typeof b[k]==='string'&&b[k].trim()&&b[k].length<=300))throw Error('課節缺少有效ID、課程、年級、班級、科目或教師');
  if(ids.has(b.id))throw Error('重複拼圖ID：'+b.id);ids.add(b.id);
  for(const k of ['subjectCode','room'])if(b[k]!==undefined&&typeof b[k]!=='string')throw Error('科目編號或課室格式不正確');
  if(b.locked!==undefined&&typeof b.locked!=='boolean')throw Error('鎖定狀態格式不正確');
  const headcount=b.headcount===undefined||b.headcount===null||b.headcount===''?null:Number(b.headcount);
  if(headcount!==null&&(!Number.isInteger(headcount)||headcount<1||headcount>10000))throw Error('班級人數須為1–10000，或留空');
  return {id:b.id,program:text(b.program),grade:text(b.grade),className:text(b.className),subject:text(b.subject),subjectCode:text(b.subjectCode).toUpperCase(),teacher:text(b.teacher),room:text(b.room).toUpperCase(),locked:!!b.locked,headcount};
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
 const settings={weeks:s.weeks,academicMinutes:s.academicMinutes,capacity:s.capacity,semesterName:text(s.semesterName)||'未命名學期',startDate:s.startDate,endDate:s.endDate};
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
 for(const group of groups.values())if(group.some(i=>i.day!==group[0].day||i.slot!==group[0].slot||i.block.teacher!==group[0].block.teacher||!sameSubject(i.block,group[0].block)||i.block.room!==group[0].block.room)||new Set(group.map(i=>cls(i.block))).size!==group.length)throw Error('合班必須同時段、同教師、同科目、同課室及不同班級');
 return {schemaVersion:4,unassignedBlocks,timetable,settings,rooms,rules,holidays,followups};
}
function matchesRule(rule,b){return rule.kind==='global'||rule.kind==='teacher'&&rule.target===b.teacher||rule.kind==='room'&&rule.target===b.room||rule.kind==='program'&&rule.target===b.program||rule.kind==='class'&&rule.target===cls(b);}
const restrictions=(rules,b,day,slot)=>rules.filter(r=>matchesRule(r,b)&&r.cells.includes(day+':'+slot));
function conflicts(a,b){if(a.day!==b.day||a.slot!==b.slot)return [];const out=[];const merge=a.mergeId&&a.mergeId===b.mergeId&&sameSubject(a.block,b.block)&&a.block.teacher===b.block.teacher&&a.block.room===b.block.room;if(cls(a.block)===cls(b.block))out.push('班級撞堂');if(a.block.teacher===b.block.teacher&&!merge)out.push('教師撞堂');if(a.block.room&&a.block.room===b.block.room&&!merge)out.push('課室撞堂');return out;}
function audit(timetable){const out=[];const groups=new Map();for(const i of timetable){const k=i.day+':'+i.slot;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}for(const items of groups.values())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){const types=conflicts(items[a],items[b]);if(types.length)out.push({a:items[a],b:items[b],types});}return out;}
function roomPressure(data,day,slot){
 const items=data.timetable.filter(i=>i.day===day&&i.slot===slot);
 const names=[...new Set([...data.rooms.map(r=>r.name),...items.map(i=>i.block.room).filter(Boolean)])];
 return names.map(name=>{const list=items.filter(i=>i.block.room===name),room=data.rooms.find(r=>r.name===name),seats=list.reduce((sum,i)=>sum+(i.block.headcount||0),0),unknown=list.filter(i=>i.block.headcount===null||i.block.headcount===undefined).length;const sessions=new Set(list.map(session)).size;
  const blocked=restrictions(data.rules,{room:name},day,slot).length>0;
  return {name,capacity:room?room.capacity:null,seats,unknown,sessions,blocked,over:!!room&&seats>room.capacity,conflict:sessions>1,ratio:room?seats/room.capacity:null};
 });
}
function slotLoad(timetable,day,slot){const items=timetable.filter(i=>i.day===day&&i.slot===slot);return {classes:items.length,sessions:new Set(items.map(session)).size,rooms:new Set(items.map(i=>i.block.room).filter(Boolean)).size,missingRooms:items.filter(i=>!i.block.room).length};}
function pressure(data,day,slot){const rows=roomPressure(data,day,slot),load=slotLoad(data.timetable,day,slot);const available=rows.filter(r=>r.capacity!==null&&!r.blocked);return {...load,rows,availableRooms:available.length,occupiedRooms:available.filter(r=>r.sessions>0).length,totalSeats:available.reduce((s,r)=>s+r.capacity,0),overRooms:rows.filter(r=>r.over).length,unknownClasses:data.timetable.filter(i=>i.day===day&&i.slot===slot&&(i.block.headcount===null||i.block.headcount===undefined)).length,unregistered:rows.filter(r=>r.sessions&&!r.capacity).length,conflictRooms:rows.filter(r=>r.conflict||r.blocked&&r.sessions).length};}
function placement(data,blockId,day,slot){
 const original=data.timetable.find(i=>i.block.id===blockId),b=original?original.block:data.unassignedBlocks.find(b=>b.id===blockId);
 const fail=message=>({ok:false,message});if(!b)return fail('找不到課節');if(b.locked)return fail('此課節已鎖定');if(!Number.isInteger(day)||day<1||day>7||!Number.isInteger(slot)||slot<1||slot>8)return fail('無效時段');
 if(original&&original.day===day&&original.slot===slot)return {ok:true,noChange:true};
 if(original&&original.mergeId)return fail('合班課請先移回待排池，再重新安排');
 const limits=restrictions(data.rules,b,day,slot);if(limits.length)return fail('不符合排課限制：'+limits.map(r=>r.reason||r.target||'全院禁排').join('；'));
 const others=data.timetable.filter(i=>i!==original&&i.day===day&&i.slot===slot);
 if(others.some(i=>cls(i.block)===cls(b)))return fail('班級撞堂');
 const merge=others.filter(i=>i.block.teacher===b.teacher);
 if(merge.some(i=>!sameSubject(i.block,b)||i.block.room!==b.room))return fail('教師撞堂：科目或課室不同');
 if(new Set(merge.map(i=>i.mergeId||i.block.id)).size>1)return fail('教師已有未解決衝突');
 if(merge.some(i=>i.block.locked))return fail('合班對象已鎖定，請先解鎖');
 if(b.room&&others.some(i=>i.block.room===b.room&&!merge.includes(i)))return fail('課室撞堂');
 const room=data.rooms.find(r=>r.name===b.room),sum=(b.headcount||0)+merge.reduce((s,i)=>s+(i.block.headcount||0),0);
 if(room&&sum>room.capacity)return fail(`課室容量不足：${b.room} 已知人數${sum}，容量${room.capacity}`);
 return {ok:true,needsMerge:merge.length>0,mergeIds:merge.map(i=>i.block.id)};
}
function stats(pool,timetable,settings,timeSlots=slots){const map=new Map();const get=t=>{if(!map.has(t))map.set(t,{name:t,classes:new Set(),scheduled:0,pending:0,minutes:0,physical:new Set()});return map.get(t);};const label=b=>`${b.program} ${b.grade}${b.className} ${b.subjectCode} ${b.subject}`;pool.forEach(b=>{const s=get(b.teacher);s.classes.add(label(b));s.pending++;});timetable.forEach(i=>{const s=get(i.block.teacher);s.classes.add(label(i.block));s.scheduled++;s.minutes+=minutes(timeSlots.find(s=>s.num===i.slot));s.physical.add(session(i));});return [...map.values()].map(s=>({name:s.name,classes:[...s.classes].sort(),scheduled:s.scheduled,pending:s.pending,physical:s.physical.size,clockHours:round(s.minutes*settings.weeks/60),numerator:round(s.minutes*settings.weeks/settings.academicMinutes),denominator:round((s.minutes+s.pending*75)*settings.weeks/settings.academicMinutes)})).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));}
function holidayImpacts(data){
 if(!data.settings.startDate||!data.settings.endDate)return [];
 const map=new Map();
 for(const h of data.holidays.filter(h=>h.enabled)){
  const from=h.date>data.settings.startDate?h.date:data.settings.startDate;
  const endDate=h.endDate||h.date,to=endDate<data.settings.endDate?endDate:data.settings.endDate;
  for(let date=from;date<=to;date=nextDate(date))for(const i of data.timetable){
   const [start,end]=slotRange(i.slot);if(i.day!==weekday(date)||start>=h.end||end<=h.start)continue;
   const key=date+'|'+i.block.id;if(!map.has(key))map.set(key,{key,date,item:i,names:[],status:data.followups[key]?.status||'pending',note:data.followups[key]?.note||''});
   const row=map.get(key);if(!row.names.includes(h.name))row.names.push(h.name);
  }
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.item.slot-b.item.slot||a.item.block.className.localeCompare(b.item.block.className));
}
function fullAudit(data){const issues=audit(data.timetable).map(x=>({type:x.types.join('／'),item:x.a,detail:`${x.a.block.subject} ↔ ${x.b.block.subject}（${x.b.block.teacher}）`}));for(const i of data.timetable){const rs=restrictions(data.rules,i.block,i.day,i.slot);if(rs.length)issues.push({type:'排課限制',item:i,detail:rs.map(r=>r.reason||r.target||'全院禁排').join('；')});}for(let day=1;day<=7;day++)for(let slot=1;slot<=8;slot++)for(const r of roomPressure(data,day,slot).filter(r=>r.over))issues.push({type:'課室超容量',item:data.timetable.find(i=>i.day===day&&i.slot===slot&&i.block.room===r.name),detail:`${r.name} 已知人數${r.seats} / ${r.capacity}${r.unknown?'（另有人數未填）':''}`});return issues;}
function parseCSV(input){const rows=[];let row=[],cell='',quoted=false;input=input.replace(/^\uFEFF/,'');for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==','){if(c==='\r'&&input[i+1]==='\n')i++;if(row.some(x=>x.trim()))rows.push(row);row=[];}}else cell+=c;}if(quoted)throw Error('CSV引號未關閉');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;}
function parseHolidayCSV(input){const rows=parseCSV(input);if(!rows.length)throw Error('CSV沒有資料');const head=rows.shift().map(s=>s.trim().toLowerCase());const col=(name,r)=>r[head.indexOf(name)]?.trim()||'';if(!head.includes('date')||!head.includes('name'))throw Error('CSV須包含 date,name 欄位');return rows.map((r,n)=>({id:'csv-'+n+'-'+col('date',r),date:col('date',r),endDate:col('end_date',r)||col('date',r),name:col('name',r),start:col('start',r)?clock(col('start',r)):0,end:col('end',r)?clock(col('end',r)):1440,enabled:!['false','0'].includes(col('enabled',r).toLowerCase()),source:'CSV匯入'}));}
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
return {defaults,slots,validate,conflicts,audit,fullAudit,slotLoad,roomPressure,pressure,stats,placement,restrictions,holidayImpacts,parseHolidayCSV,parseICS,sameSubject,cls,session,minutes,clock,dateISO,weekday,round};
});
