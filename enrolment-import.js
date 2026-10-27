/* Local enrolment export reader. Never uploads files or changes timetable positions. */
(function(root,factory){const api=factory(typeof module==='object'?require('./scheduler-core.js'):root.FOFCore);if(typeof module==='object')module.exports=api;else root.FOFEnrolment=api;})(typeof globalThis!=='undefined'?globalThis:this,C=>{
'use strict';
const programmes=Object.fromEntries(C.programmes.map(p=>[p.code,p.name]));
const crossSubjects=['BAE101','BAE102','BAE103','BAE104','BAE105','BAE106','BAE201','BAE205','BAE206','BAE207'];
const str=x=>String(x??'').trim(),norm=x=>str(x).normalize('NFKC').replace(/\s/g,'').toUpperCase();
const roomName=x=>norm(x).replace(/^GDC-/,'');
const gradeNumber=x=>({大一:1,大二:2,大三:3,大四:4,研一:1,研二:2,研三:3,博一:1,博二:2,博三:3}[str(x)]||Number(x));
const targetKey=b=>JSON.stringify([C.cls(b),norm(b.subjectCode)]);
function targets(data){const map=new Map();for(const b of [...data.unassignedBlocks,...data.timetable.map(i=>i.block)]){const key=targetKey(b);if(!map.has(key))map.set(key,{key,block:b,blocks:[]});map.get(key).blocks.push(b);}return [...map.values()].map(t=>({...t,label:`${t.block.subjectCode} · ${t.block.program} · ${t.block.grade}${t.block.className}班 · ${t.block.subject}`}));}
function parseTimes(value){const raw=str(value),cells=[],warnings=[];let m;const re=/星期([一二三四五六日天])\s*(\d{1,2})\/(\d{2}:\d{2})-(\d{2}:\d{2})/g;while((m=re.exec(raw))){const slot=Number(m[2]),day='一二三四五六日'.indexOf(m[1]==='天'?'日':m[1])+1;if(C.slots[slot-1]?.time!==m[3]+'-'+m[4]){warnings.push('節次與時間不符，該時段課室不自動配對');continue;}if(!cells.some(c=>c.day===day&&c.slot===slot))cells.push({day,slot,time:C.slots[slot-1].time});}
 const prefix=raw.split('星期')[0];const rooms=[...new Set((prefix.toUpperCase().match(/(?:[A-Z]+-)?[A-Z]\d{3,6}\b/g)||[]).map(roomName))];
 if(!cells.length)warnings.push('未識別有效上課時段');if(!rooms.length)warnings.push('未識別課室');if(rooms.length>1)warnings.push('多個課室未逐節對應，請選擇各時段課室；留空則保留原值');return {cells,rooms,warnings};}
function parseWorkbook(wb,X){let rows=[],recognized=0;
 for(const sheet of wb.SheetNames){const ws=wb.Sheets[sheet];if(!ws['!ref'])continue;const range=X.utils.decode_range(ws['!ref']);if(range.e.r>20000||range.e.c>100)throw Error('工作表過大（最多20001行、101欄）');const table=X.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});const h=table.slice(0,30).findIndex(r=>['科目總碼','科目名稱','正選人數','教室節次館別'].every(k=>r.map(str).includes(k)));if(h<0)continue;recognized++;const header=table[h].map(str);if(new Set(header.filter(Boolean)).size!==header.filter(Boolean).length)throw Error('選科表欄名重複');
  for(let n=h+1;n<table.length;n++){const a=table[n];if(!a.some(v=>str(v)))continue;const r={sheet,row:n+1};header.forEach((k,i)=>{if(k)r[k]=a[i];});rows.push(r);}
 }
 if(!recognized)throw Error('找不到選科表欄位：科目總碼、科目名稱、正選人數、教室節次館別');if(rows.length>10000)throw Error('選科資料超過10000列');if(!rows.length)throw Error('選科表沒有課程資料');return aggregate(rows);
}
function aggregate(rows){const groups=new Map(),unresolved=[],seen=new Map(),duplicates=[],terms=new Set();
 for(const r of rows){const id=norm(r['科目總碼']),title=str(r['科目名稱']),m=title.match(/-\s*([A-Z]+\d+)-(.+)$/i),prefix=id.match(/^(\d{3})(BAECF|MFICF|MFTBF|DFICF)(\d)([A-Z])/),countRaw=r['正選人數'];
  if(!m||!prefix){unresolved.push({sheet:r.sheet,row:r.row,name:title,reason:'科目總碼或科目名稱格式未能配對'});continue;}
  const subjectCode=m[1].toUpperCase(),suffix=norm(m[2]),cross=/跨課程/.test(suffix),cm=suffix.match(/^跨課程[併并](\d+)([A-Z]+)$/),base=suffix.match(/^([A-Z]+)$/);
  if(cross&&!cm||!cross&&!base){unresolved.push({sheet:r.sheet,row:r.row,name:title,reason:'班級或跨課程併班標記不明'});continue;}
  const grade=cross?Number(cm[1]):Number(prefix[3]),className=cross?cm[2]:base[1],key=JSON.stringify([prefix[1],prefix[2],grade,className,subjectCode]);terms.add(prefix[1]);
  if(!groups.has(key))groups.set(key,{key,term:prefix[1],programCode:prefix[2],program:programmes[prefix[2]],grade,className,subjectCode,subject:title.slice(0,m.index).trim(),base:0,cross:0,total:null,bases:[],crosses:[],warnings:[],errors:[],cells:[],roomCandidates:[],capacity:null});const g=groups.get(key);
  const signature=JSON.stringify(['科目名稱','正選人數','教室節次館別','授課教師','教室容量','必選修別'].map(k=>r[k]??''));if(seen.has(id)){if(seen.get(id).signature!==signature){g.errors.push('同一科目總碼有互相矛盾資料，不能自動相加');groups.get(seen.get(id).key).errors.push('同一科目總碼有互相矛盾資料，不能自動相加');}else duplicates.push({id,sheet:r.sheet,row:r.row});continue;}seen.set(id,{signature,key});
  const count=Number(countRaw),valid=!(countRaw===''||countRaw===null||countRaw===undefined||typeof countRaw==='boolean')&&Number.isInteger(count)&&count>=0&&count<=10000;
  if(!valid)g.errors.push('正選人數缺漏或不是0–10000整數');if(!id.endsWith(subjectCode+'00'))g.errors.push('科目名稱的編號與科目總碼不符');if(!cross&&(grade!==Number(prefix[3])||className!==prefix[4])){g.warnings.push('科目總碼班次與名稱班別不同，以名稱班別配對，請人工核對');g.needsReview=true;};
  const schedule=parseTimes(r['教室節次館別']),source={id,name:title,count:valid?count:null,sheet:r.sheet,row:r.row,teacher:str(r['授課教師']),type:str(r['必選修別']),schedule,capacity:Number(r['教室容量'])||null};
  (cross?g.crosses:g.bases).push(source);g.warnings.push(...schedule.warnings);if(cross&&!crossSubjects.includes(subjectCode)){g.warnings.push('此科不在常見跨課程清單，請核對後勾選');g.needsReview=true;};
 }
 if(terms.size>1)throw Error('表內包含多個學期代碼，請先分開學期匯出');
 for(const g of groups.values()){
  if(g.bases.length!==1)g.errors.push(g.bases.length?'同一主班有多列，不能判定是否重複':'跨課程併班找不到主班');
  const b=g.bases[0];if(b){g.teacher=b.teacher;g.courseType=b.type;g.cells=b.schedule.cells;g.roomCandidates=b.schedule.rooms;g.capacity=b.capacity;for(const x of g.crosses)if(norm(x.teacher)!==norm(b.teacher)||JSON.stringify(x.schedule.cells)!==JSON.stringify(b.schedule.cells)||JSON.stringify([...x.schedule.rooms].sort())!==JSON.stringify([...b.schedule.rooms].sort()))g.errors.push('跨課程列與主班的教師／時間／課室不一致');}
  g.base=g.bases.reduce((s,x)=>s+(x.count??0),0);g.cross=g.crosses.reduce((s,x)=>s+(x.count??0),0);if(!g.errors.length){g.total=g.base+g.cross;if(g.total>10000)g.errors.push('合計人數超過10000');}g.warnings=[...new Set(g.warnings)];g.errors=[...new Set(g.errors)];
 }
 return {groups:[...groups.values()],unresolved,duplicates,terms:[...terms],sourceRows:rows.length};
}
function review(parsed,data){const list=targets(data);return {...parsed,targets:list.map(t=>({key:t.key,label:t.label,code:norm(t.block.subjectCode)})),groups:parsed.groups.map(g=>{
 const matches=list.filter(t=>norm(t.block.subjectCode)===g.subjectCode&&t.block.program===g.program&&gradeNumber(t.block.grade)===g.grade&&norm(t.block.className)===g.className);const target=matches.length===1?matches[0]:null;
 const warnings=[...g.warnings];if(!target)warnings.push(matches.length?'有多個配對，請選擇目標班級':'尚未配對現有科目班級');if(target?.blocks.some(b=>b.locked))warnings.push('目標有鎖定課節，請先解鎖再重新匯入');if(target&&target.blocks.some(b=>norm(b.teacher)!==norm(g.teacher)))warnings.push('教師名稱與現有資料不同；匯入不改教師，請核對目標');
 const scheduled=data.timetable.filter(i=>target?.blocks.some(b=>b.id===i.block.id));if(scheduled.some(i=>!g.cells.some(c=>c.day===i.day&&c.slot===i.slot)))warnings.push('部分已排節次與表內時間不同；保留該節課室，不移動時間');
 return {...g,warnings,targetKey:target?.key||'',selected:!!target&&!g.errors.length&&!g.needsReview&&!target.blocks.some(b=>b.locked),assignments:g.cells.map(c=>({...c,room:g.roomCandidates.length===1?g.roomCandidates[0]:''})),poolRoom:g.roomCandidates.length===1?g.roomCandidates[0]:''};
 }),capacities:capacityReview(parsed,data)};}
function capacityReview(parsed,data){const m=new Map();for(const g of parsed.groups.filter(g=>!g.errors.length&&g.roomCandidates.length===1&&Number.isInteger(g.capacity)&&g.capacity>0)){
 const name=g.roomCandidates[0];if(!m.has(name))m.set(name,new Set());m.get(name).add(g.capacity);
 }return [...m].map(([name,set])=>{const values=[...set].sort((a,b)=>a-b),existing=data.rooms.find(r=>roomName(r.name)===name)?.capacity;return {name,values,existing:existing??null,capacity:values.length===1?values[0]:'',selected:values.length===1&&(existing===undefined||existing===values[0])};});}
const existingRoomName=(data,name)=>data.rooms.find(r=>roomName(r.name)===name)?.name||[...data.unassignedBlocks,...data.timetable.map(i=>i.block)].find(b=>b.room&&roomName(b.room)===name)?.room;
function apply(data,review,options){
 const list=targets(data),used=new Set();let blocks=0,groups=0,rooms=0,roomCells=0;
 for(const g of review.groups.filter(g=>g.selected)){
  if(g.errors.length||g.total===null)throw Error('所選班級有未解決的來源錯誤');const t=list.find(t=>t.key===g.targetKey);if(!t||norm(t.block.subjectCode)!==g.subjectCode)throw Error('請先為所選項目配對相同科目編號的班級');if(used.has(t.key))throw Error('多個匯入項目指向同一班級，請核對配對');used.add(t.key);if(t.blocks.some(b=>b.locked))throw Error('所選班級含鎖定課節，請先解鎖');groups++;
  for(const b of t.blocks){if(options.counts){b.headcount=g.total;b.enrolment={base:g.base,cross:g.cross,term:g.term,sourceIds:[...g.bases,...g.crosses].map(s=>s.id)};}
   if(options.rooms){const item=data.timetable.find(i=>i.block.id===b.id),assigned=item?g.assignments.find(c=>c.day===item.day&&c.slot===item.slot)?.room:g.poolRoom;if(assigned){const name=roomName(assigned);b.room=existingRoomName(data,name)||name;roomCells++;}}
   blocks++;
  }
 }
 if(!groups)throw Error('請至少選擇一個已配對班級');if(!options.counts&&!options.rooms&&!options.capacities)throw Error('請選擇要匯入的資料');
 if(options.capacities)for(const r of review.capacities.filter(r=>r.selected)){if(!Number.isInteger(Number(r.capacity))||Number(r.capacity)<1||Number(r.capacity)>10000)throw Error('教室容量須為1–10000');const existing=data.rooms.find(x=>roomName(x.name)===r.name);if(existing)existing.capacity=Number(r.capacity);else data.rooms.push({name:existingRoomName(data,r.name)||r.name,capacity:Number(r.capacity)});rooms++;}
 if(options.confirmStage)data.settings.stage='confirmed';return {groups,blocks,rooms,roomCells};
}
return {programmes,crossSubjects,roomName,targetKey,targets,parseTimes,parseWorkbook,aggregate,review,apply};
});
