/* Offline interface. All user data stays in this browser unless explicitly exported. */
const {createApp,ref,reactive,computed,watch,nextTick}=Vue;
const FOFApp={setup(){
 const V=FOFVisual;const pointerReady=ref(false),showSuggestions=ref(false),suggestionMode=ref('balanced'),suggestWeekends=ref(false);
 const C=FOFCore,storageKey='fof_scheduling_v3',message=ref(''),notice=ref('');
 let initial,revision=0,stale=false;
 try{const saved=localStorage.getItem(storageKey);const old=localStorage.getItem('fof_scheduling_v2');const raw=saved?JSON.parse(saved):old?JSON.parse(old):{unassignedBlocks:JSON.parse(localStorage.getItem('fai_unassignedBlocks')||'[]'),timetable:JSON.parse(localStorage.getItem('fai_timetable')||'[]')};initial=C.validate(raw);revision=saved?raw.revision||0:0;}catch(e){initial=C.validate({unassignedBlocks:[],timetable:[]});message.value='未能讀取本機資料：'+e.message+'。原資料未覆寫，請匯入有效備份。';}
 const data=reactive(initial),tab=ref('board'),view=ref('class'),selected=ref(''),search=ref(''),poolProgram=ref(''),classKey=ref(''),teacher=ref(''),roomView=ref(''),modal=ref(''),draft=ref({}),history=ref([]),future=ref([]),printKeys=ref([]),printPages=ref([]),holidayPreview=ref([]),holidayYear=ref(2027),impactStatus=ref('all'),pressureDay=ref(1),pressureSlot=ref(1);
 let largePreference=false;try{largePreference=localStorage.getItem('fof_large_text')==='1';}catch(e){}
 const largeText=ref(largePreference);function toggleLargeText(){largeText.value=!largeText.value;try{localStorage.setItem('fof_large_text',largeText.value?'1':'0');}catch(e){}}
 const programs=['應用經濟學學士學位課程','金融學碩士學位課程','金融科技碩士學位課程','金融學博士學位課程'];
 const nav=[{id:'board',label:'排課工作台',sub:'班級與教師課表'},{id:'pressure',label:'教室容量壓力',sub:'時段負荷與座位需求'},{id:'stats',label:'教學時數',sub:'按班累加核算'},{id:'rules',label:'排課限制',sub:'教師與禁排時段'},{id:'rooms',label:'教室資料',sub:'容量與班級人數'},{id:'holidays',label:'假期與補課',sub:'日期檢查與跟進'}];
 const days=['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
 watch(modal,(v,old)=>{if(v&&v!==old)notice.value='';},{flush:'sync'});
 const snapshot=()=>JSON.stringify(data),allBlocks=computed(()=>[...data.unassignedBlocks,...data.timetable.map(i=>i.block)]);
 const classes=computed(()=>{const map=new Map();for(const b of allBlocks.value)map.set(C.cls(b),{key:C.cls(b),program:b.program,grade:b.grade,className:b.className,label:b.program+' · '+b.grade+b.className+'班'});return [...map.values()].sort((a,b)=>a.program.localeCompare(b.program)||a.grade.localeCompare(b.grade)||a.className.localeCompare(b.className));});
 watch(classes,list=>{if(!list.some(c=>c.key===classKey.value))classKey.value=list[0]?.key||'';},{immediate:true});
 const teachers=computed(()=>[...new Set(allBlocks.value.map(b=>b.teacher))].sort((a,b)=>a.localeCompare(b,'zh-Hant')));
 watch(teachers,list=>{if(!list.includes(teacher.value))teacher.value=list[0]||'';},{immediate:true});
 const cohorts=computed(()=>{const m=new Map();for(const b of allBlocks.value){const key=C.cls(b)+'|'+b.subjectCode+'|'+b.subject;if(!m.has(key))m.set(key,{block:b,counts:[]});const label=b.headcount===null?'未填':b.headcount+'人';if(!m.get(key).counts.includes(label))m.get(key).counts.push(label);}return [...m.values()];});
 const allPrograms=computed(()=>[...new Set([...programs,...allBlocks.value.map(b=>b.program)])]);
 const filteredPool=computed(()=>data.unassignedBlocks.filter(b=>(!poolProgram.value||b.program===poolProgram.value)&&(!search.value||[b.program,b.grade,b.className,b.subject,b.subjectCode,b.teacher,b.room].join(' ').toLowerCase().includes(search.value.toLowerCase()))));
 const stats=computed(()=>C.stats(data.unassignedBlocks,data.timetable,data.settings));
 const issues=computed(()=>C.fullAudit(data));
 const impacts=computed(()=>C.holidayImpacts(data));
 const filteredImpacts=computed(()=>impacts.value.filter(i=>impactStatus.value==='all'||i.status===impactStatus.value));
 const pendingImpacts=computed(()=>impacts.value.filter(i=>i.status==='pending').length);
 const knownCount=computed(()=>allBlocks.value.filter(b=>b.headcount!==null).length);
 const selectedBlock=computed(()=>allBlocks.value.find(b=>b.id===selected.value));
 const proposed=computed(()=>selected.value?C.suggestions(data,selected.value,suggestionMode.value,suggestWeekends.value):[]);
 const programStyle=V.style,programInfo=V.program;
 const boardTitle=computed(()=>view.value==='teacher'?(teacher.value||'選擇教師'):view.value==='room'?(roomView.value||'選擇課室'):(classes.value.find(c=>c.key===classKey.value)?.label||'建立課程後開始排課'));
 function notify(s){notice.value=s;}
 function apply(raw){Object.assign(data,C.validate(raw));selected.value='';}
 function mutate(fn){try{const d=JSON.parse(snapshot());fn(d);const clean=C.validate(d);history.value.push(snapshot());if(history.value.length>50)history.value.shift();future.value=[];Object.assign(data,clean);return true;}catch(e){notify(e.message);return false;}}
 function undo(){if(!history.value.length)return;future.value.push(snapshot());apply(JSON.parse(history.value.pop()));}
 function redo(){if(!future.value.length)return;history.value.push(snapshot());apply(JSON.parse(future.value.pop()));}
 window.addEventListener('storage',e=>{if(e.key===storageKey){stale=true;message.value='另一視窗已有更新，本視窗已停止自動儲存。請先備份，再重新載入。';}});
 watch(data,()=>{if(stale)return;try{const latest=JSON.parse(localStorage.getItem(storageKey)||'{}');if((latest.revision||0)>revision){stale=true;throw Error('另一視窗已更新，請備份後重新載入');}localStorage.setItem(storageKey,JSON.stringify({...JSON.parse(snapshot()),revision:++revision,updatedAt:new Date().toISOString()}));}catch(e){message.value='未能自動儲存：'+e.message+'。請立即備份。';}},{deep:true});
 const uid=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 const showTime=n=>C.slots[n-1]?.time||'';
 const formatMinute=n=>n===1440?'24:00':String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 function choose(b){selected.value=b.id;classKey.value=C.cls(b);view.value='class';}
 function cellItems(day,slot){return data.timetable.filter(i=>i.day===day&&i.slot===slot&&(view.value==='teacher'?i.block.teacher===teacher.value:view.value==='room'?i.block.room===roomView.value:C.cls(i.block)===classKey.value));}
 function cellLimits(day,slot){let b=selectedBlock.value;if(!b){if(view.value==='teacher')b={teacher:teacher.value};else if(view.value==='room')b={room:roomView.value};else {const c=classes.value.find(c=>c.key===classKey.value);b=c||{};}}return C.restrictions(data.rules,b,day,slot);}
 function place(id,day,slot){const plan=C.placement(data,id,day,slot);if(!plan.ok){notify(plan.message);return false;}if(plan.noChange){selected.value='';return true;}
  if(plan.needsMerge&&!confirm('確認為實際合班？教室座位按各班人數相加；教學時數亦按各班累加。'))return false;
  const ok=mutate(d=>{const old=d.timetable.find(i=>i.block.id===id);const b=old?old.block:d.unassignedBlocks.find(b=>b.id===id);let mergeId;
   if(plan.needsMerge){mergeId=d.timetable.find(i=>i.block.id===plan.mergeIds[0]).mergeId||'M_'+uid();d.timetable.filter(i=>plan.mergeIds.includes(i.block.id)).forEach(i=>i.mergeId=mergeId);}
   if(old){old.day=day;old.slot=slot;if(mergeId)old.mergeId=mergeId;}else{d.timetable.push({day,slot,block:b,...(mergeId?{mergeId}:{})});d.unassignedBlocks=d.unassignedBlocks.filter(x=>x.id!==id);}});
  if(ok){selected.value='';notify('已安排課節');}return ok;
 }
 function drop(event,day,slot){const id=event.dataTransfer?.getData('text/plain')||selected.value;if(id)place(id,day,slot);}
 function drag(event,b){if(b.locked){event.preventDefault();return;}event.dataTransfer.setData('text/plain',b.id);event.dataTransfer.effectAllowed='move';}
 function returnPool(id){const i=data.timetable.find(i=>i.block.id===id);if(!i)return;if(i.block.locked){notify('請先解鎖課節');return;}mutate(d=>{const row=d.timetable.find(i=>i.block.id===id);d.timetable=d.timetable.filter(i=>i.block.id!==id);d.unassignedBlocks.push(row.block);});selected.value='';}
 function poolDrop(event){returnPool(event.dataTransfer.getData('text/plain'));}
 function removePool(id){if(confirm('刪除此待排課節？可撤銷。'))mutate(d=>d.unassignedBlocks=d.unassignedBlocks.filter(b=>b.id!==id));}
 function lock(id){mutate(d=>{const b=d.timetable.find(i=>i.block.id===id)?.block;if(b)b.locked=!b.locked;});}
 function openBatch(){draft.value={program:programs[0],grade:'大一',rows:[{subjectCode:'',subject:'',teacher:'',classStart:'A',classEnd:'A',lessons:2,room:'',headcount:''}]};modal.value='batch';}
 function addBatchRow(){draft.value.rows.push({subjectCode:'',subject:'',teacher:'',classStart:'A',classEnd:'A',lessons:2,room:'',headcount:''});}
 function generate(){const f=draft.value;for(const r of f.rows)if(!r.subject.trim()||!r.teacher.trim()||! /^[A-Z]$/.test(r.classStart)||! /^[A-Z]$/.test(r.classEnd)||r.classStart>r.classEnd||!Number.isInteger(Number(r.lessons))||r.lessons<1||r.lessons>56){notify('請填妥每列科目、教師、A–Z班級範圍及每週1–56節');return;}
  if(mutate(d=>{for(const r of f.rows)for(let c=r.classStart.charCodeAt(0);c<=r.classEnd.charCodeAt(0);c++)for(let n=0;n<r.lessons;n++)d.unassignedBlocks.push({id:'B_'+uid(),program:f.program,grade:f.grade,className:String.fromCharCode(c),subjectCode:r.subjectCode,subject:r.subject,teacher:r.teacher,room:r.room,headcount:r.headcount,locked:false});}))modal.value='';
 }
 function edit(b,group=false){draft.value={...b,headcount:b.headcount??'',applyGroup:group};modal.value='edit';}
 function saveBlock(){const f=draft.value;const original=data.timetable.find(i=>i.block.id===f.id);if(original?.block.locked){notify('請先解鎖課節');return;}
  const clean={id:f.id,program:f.program,grade:f.grade,className:f.className,subjectCode:f.subjectCode,subject:f.subject,teacher:f.teacher,room:f.room,headcount:f.headcount,locked:!!f.locked};
  if(original?.mergeId&&['subjectCode','subject','teacher','room'].some(k=>(clean[k]||'').trim()!==(original.block[k]||''))){notify('合班科目／教師／課室變動前，請先移回待排池');return;}
  const groupKey=b=>C.cls(b)===C.cls(original?.block||clean)&&C.sameSubject(b,original?.block||clean);
  const ok=mutate(d=>{let affected=[];for(const b of [...d.unassignedBlocks,...d.timetable.map(i=>i.block)])if(b.id===f.id){Object.assign(b,clean);affected.push(b.id);}else if(f.applyGroup&&groupKey(b)){if(b.locked&&b.headcount!==(f.headcount===''?null:Number(f.headcount)))throw Error('同組有人數需修改的鎖定課節，請先解鎖');b.headcount=f.headcount;affected.push(b.id);}
   const v=C.validate(d);for(const i of v.timetable.filter(i=>affected.includes(i.block.id))){const limits=C.restrictions(v.rules,i.block,i.day,i.slot);if(limits.length)throw Error('修改後課節違反時段限制');if(v.timetable.some(j=>j.block.id!==i.block.id&&C.conflicts(i,j).length))throw Error('修改後會撞堂');const p=C.roomPressure(v,i.day,i.slot).find(r=>r.name===i.block.room);if(p?.over)throw Error('修改後課室容量不足');}});
  if(ok)modal.value='';
 }
 function openSettings(){draft.value={...data.settings};modal.value='settings';}
 function saveSettings(){if(mutate(d=>d.settings={...draft.value}))modal.value='';}
 function openRoom(r){draft.value=r?{...r,original:r.name}:{name:'',capacity:'',original:''};modal.value='room';}
 function saveRoom(){const f=draft.value,name=f.name.trim().toUpperCase();if(!name){notify('請填教室名稱');return;}if(mutate(d=>{if(d.rooms.some(r=>r.name===name&&r.name!==f.original))throw Error('教室名稱重複');if(f.original&&name!==f.original)throw Error('現有教室名稱不可直接改，請新增後逐課節更新');const room={name,capacity:Number(f.capacity)};const idx=d.rooms.findIndex(r=>r.name===f.original);if(idx>=0)d.rooms[idx]=room;else d.rooms.push(room);}))modal.value='';}
 function deleteRoom(name){if(confirm('刪除教室容量資料？課節上的課室名稱會保留，並標示未登記。'))mutate(d=>d.rooms=d.rooms.filter(r=>r.name!==name));}
 function openRule(r){draft.value=r?JSON.parse(JSON.stringify(r)):{id:'R_'+uid(),kind:'teacher',target:teachers.value[0]||'',reason:'',cells:[]};modal.value='rule';}
 function ruleKindChange(){draft.value.target=draft.value.kind==='teacher'?teachers.value[0]||'':draft.value.kind==='room'?data.rooms[0]?.name||'':draft.value.kind==='program'?allPrograms.value[0]||'':draft.value.kind==='class'?classes.value[0]?.key||'':'';}
 function toggleRuleCell(day,slot){const key=day+':'+slot,arr=draft.value.cells;draft.value.cells=arr.includes(key)?arr.filter(x=>x!==key):[...arr,key];}
 function toggleRuleDay(day){const arr=Array.from({length:8},(_,i)=>day+':'+(i+1));const full=arr.every(k=>draft.value.cells.includes(k));draft.value.cells=full?draft.value.cells.filter(k=>!arr.includes(k)):[...new Set([...draft.value.cells,...arr])];}
 function toggleRuleSlot(slot){const arr=Array.from({length:7},(_,i)=>(i+1)+':'+slot);const full=arr.every(k=>draft.value.cells.includes(k));draft.value.cells=full?draft.value.cells.filter(k=>!arr.includes(k)):[...new Set([...draft.value.cells,...arr])];}
 function saveRule(){if(mutate(d=>{const idx=d.rules.findIndex(r=>r.id===draft.value.id);if(idx>=0)d.rules[idx]=JSON.parse(JSON.stringify(draft.value));else d.rules.push(JSON.parse(JSON.stringify(draft.value)));}))modal.value='';}
 function deleteRule(id){if(confirm('移除此排課限制？'))mutate(d=>d.rules=d.rules.filter(r=>r.id!==id));}
 const kindLabel=k=>({teacher:'教師不可用',global:'全院禁排',program:'課程禁排',class:'班級禁排',room:'教室不可用'}[k]);
 function targetLabel(r){return r.kind==='global'?'全院所有課節':r.kind==='class'?classes.value.find(c=>c.key===r.target)?.label||JSON.parse(r.target).join(' · '):r.target;}
 const pressureMap=computed(()=>{const m=new Map();for(let day=1;day<=7;day++)for(let slot=1;slot<=8;slot++)m.set(day+':'+slot,C.pressure(data,day,slot));return m;});
 function load(day,slot){return pressureMap.value.get(day+':'+slot);}
 function loadAssessment(day,slot){return V.assessment(load(day,slot),data.rooms.length,data.settings.capacity);}
 const selectedPressure=computed(()=>load(pressureDay.value,pressureSlot.value));
 function heat(day,slot){return loadAssessment(day,slot).tone;}
 function selectPressure(day,slot){pressureDay.value=day;pressureSlot.value=slot;}
 function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportData(){download('FOF排課v3.2_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({...JSON.parse(snapshot()),exportedAt:new Date().toISOString()},null,2),'application/json');}
 async function importData(event){const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('檔案超過10MB');const incoming=C.validate(JSON.parse(await file.text()));if(!confirm(`匯入${incoming.timetable.length}個已排及${incoming.unassignedBlocks.length}個待排課節，將取代目前資料。繼續？`))return;if(mutate(d=>Object.assign(d,incoming)))notify('已匯入；請查看檢查清單及學期日期');}catch(e){notify('未能匯入：'+e.message);}finally{event.target.value='';}}
 function builtinHolidays(){const year=Number(holidayYear.value);holidayPreview.value=FOFHolidayData[year].map(([date,name])=>({id:'MO-'+year+'-'+date,date:year+'-'+date,endDate:year+'-'+date,name,start:0,end:1440,enabled:true,source:`澳門政府公眾假期${year}（2026-10-21核對）`}));modal.value='holidayPreview';}
 async function importHolidays(event){const file=event.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('檔案超過2MB');const input=await file.text();const rows=file.name.toLowerCase().endsWith('.ics')?C.parseICS(input):C.parseHolidayCSV(input,Papa);holidayPreview.value=C.validate({...JSON.parse(snapshot()),holidays:rows}).holidays;modal.value='holidayPreview';}catch(e){notify('假期未匯入：'+e.message);}finally{event.target.value='';}}
 function applyHolidays(){if(mutate(d=>{for(const h of holidayPreview.value){const idx=d.holidays.findIndex(old=>old.date===h.date&&(old.endDate||old.date)===(h.endDate||h.date)&&old.name===h.name&&old.start===h.start&&old.end===h.end);if(idx>=0)d.holidays[idx]={...h,id:d.holidays[idx].id};else d.holidays.push({...h,id:'H_'+uid()});}})){modal.value='';notify('假期已加入，重複日期／名稱／時段不重複新增');}}
 function openHoliday(h){draft.value=h?{...h,endDate:h.endDate||h.date,startText:formatMinute(h.start),endText:formatMinute(h.end)}:{id:'H_'+uid(),date:'',endDate:'',name:'',enabled:true,startText:'00:00',endText:'24:00',source:'校曆／手動輸入'};modal.value='holiday';}
 function saveHoliday(){try{const f=draft.value,h={id:f.id,date:f.date,endDate:f.endDate||f.date,name:f.name,enabled:f.enabled,start:C.clock(f.startText),end:C.clock(f.endText),source:f.source};if(mutate(d=>{const idx=d.holidays.findIndex(h=>h.id===f.id);if(idx>=0)d.holidays[idx]=h;else d.holidays.push(h);}))modal.value='';}catch(e){notify(e.message);}}
 function toggleHoliday(h){mutate(d=>{const row=d.holidays.find(x=>x.id===h.id);row.enabled=!row.enabled;});}
 function deleteHoliday(id){if(confirm('刪除此假期／停課日？'))mutate(d=>d.holidays=d.holidays.filter(h=>h.id!==id));}
 function openFollowup(row){draft.value={key:row.key,date:row.date,subject:row.item.block.subject,status:row.status,note:row.note};modal.value='followup';}
 function saveFollowup(){if(mutate(d=>d.followups[draft.value.key]={status:draft.value.status,note:draft.value.note}))modal.value='';}
 const statusLabel=s=>({pending:'待跟進',planned:'已安排',exempt:'無須補課'}[s]);
 function holidayTemplate(){download('假期匯入範本.csv','\uFEFFdate,end_date,name,start,end,enabled\n2027-01-01,2027-01-01,元旦,00:00,24:00,true\n2027-01-18,2027-02-14,寒假示例（請按校曆修改）,00:00,24:00,false\n','text/csv;charset=utf-8');}
 function openPrint(){printKeys.value=view.value==='teacher'&&teacher.value?['teacher:'+teacher.value]:classKey.value?['class:'+classKey.value]:[];modal.value='print';}
 const printOptions=computed(()=>[...classes.value.map(c=>({key:'class:'+c.key,label:c.label})),...teachers.value.map(t=>({key:'teacher:'+t,label:'教師 · '+t}))]);
 async function print(){printPages.value=printKeys.value.map(key=>{const isTeacher=key.startsWith('teacher:'),target=key.slice(isTeacher?8:6);const items=data.timetable.filter(i=>isTeacher?i.block.teacher===target:C.cls(i.block)===target);return {key,title:isTeacher?target+' · 教師課表':classes.value.find(c=>c.key===target)?.label||target,items,subtitle:isTeacher?'全院任教安排':'每週固定課表',affected:impacts.value.filter(row=>items.some(i=>i.block.id===row.item.block.id)).length};});modal.value='';await nextTick();window.print();}
 const printedItems=(p,day,slot)=>{const groups=new Map();for(const i of p.items.filter(i=>i.day===day&&i.slot===slot)){const key=p.key.startsWith('teacher:')?C.session(i):i.block.id;if(!groups.has(key))groups.set(key,{...i,classLabels:[]});groups.get(key).classLabels.push(i.block.grade+i.block.className);}return [...groups.values()].map(i=>({...i,classLabel:i.classLabels.join(' / ')}));};
 function exportExcel(){const wb=XLSX.utils.book_new();const add=(name,rows)=>{const ws=XLSX.utils.json_to_sheet(rows);ws['!cols']=Object.keys(rows[0]||{}).map(()=>({wch:22}));XLSX.utils.book_append_sheet(wb,ws,name);};
  const detail=i=>({'課程':i.block.program,'年級':i.block.grade,'班級':i.block.className,'科目編號':i.block.subjectCode,'科目':i.block.subject,'教師':i.block.teacher,'星期':i.day,'節次':i.slot,'時間':showTime(i.slot),'課室':i.block.room,'人數':i.block.headcount??'未填','合班ID':i.mergeId||''});
  add('排課明細',data.timetable.map(detail));add('待排課',data.unassignedBlocks.map(b=>({'課程':b.program,'年級':b.grade,'班級':b.className,'科目':b.subject,'教師':b.teacher,'課室':b.room,'人數':b.headcount??'未填'})));
  add('教學時數',stats.value.map(s=>({'教師':s.name,'任教明細':s.classes.join('；'),'每週班級節次':s.scheduled,'每週實際課堂':s.physical,'待排節次':s.pending,'已排名義學時':s.numerator,'總學時':s.denominator,'按班鐘點小時':s.clockHours,'計算口徑':'合班各班相加；假期未自動扣減'})));
  const loads=[];for(let day=1;day<=7;day++)for(let slot=1;slot<=8;slot++){const p=load(day,slot);loads.push({'星期':day,'節次':slot,'實際課堂':p.sessions,'班級節次':p.classes,'可用已登記教室':p.availableRooms,'已佔用已登記教室':p.occupiedRooms,'未填課室班次':p.missingRooms,'未填人數班次':p.unknownClasses,'超容量教室':p.overRooms});}add('時段壓力',loads);
  add('教室容量',data.rooms.map(r=>({'教室':r.name,'容量':r.capacity})));add('排課限制',data.rules.map(r=>({'類型':kindLabel(r.kind),'對象':targetLabel(r),'禁排格':r.cells.join('；'),'原因':r.reason})));
  add('假期撞課跟進',impacts.value.map(r=>({'日期':r.date,'假期':r.names.join('／'),...detail(r.item),'狀態':statusLabel(r.status),'補課跟進備註':r.note})));
  add('假期清單',data.holidays.map(h=>({'開始日期':h.date,'結束日期':h.endDate||h.date,'名稱':h.name,'開始':formatMinute(h.start),'結束':formatMinute(h.end),'啟用':h.enabled?'是':'否','來源':h.source})));
  add('設定',[data.settings]);XLSX.writeFile(wb,'FOF排課及容量假期報表.xlsx');
 }
 function openIssues(){modal.value='issues';}
 function gotoIssue(row){choose(row.item.block);tab.value='board';modal.value='';}
 return {V,pointerReady,showSuggestions,suggestionMode,suggestWeekends,proposed,programStyle,programInfo,loadAssessment,largeText,toggleLargeText,C,data,tab,view,nav,days,programs,allPrograms,classes,teachers,selected,selectedBlock,search,poolProgram,filteredPool,classKey,teacher,roomView,modal,draft,history,future,message,notice,stats,issues,impacts,filteredImpacts,pendingImpacts,knownCount,allBlocks,cohorts,boardTitle,holidayYear,holidayPreview,impactStatus,pressureDay,pressureSlot,selectedPressure,printKeys,printOptions,printPages,
 undo,redo,choose,cellItems,cellLimits,place,drop,drag,returnPool,poolDrop,removePool,lock,openBatch,addBatchRow,generate,edit,saveBlock,openSettings,saveSettings,openRoom,saveRoom,deleteRoom,openRule,ruleKindChange,toggleRuleCell,toggleRuleDay,toggleRuleSlot,saveRule,deleteRule,kindLabel,targetLabel,load,heat,selectPressure,exportData,importData,builtinHolidays,importHolidays,applyHolidays,openHoliday,saveHoliday,toggleHoliday,deleteHoliday,openFollowup,saveFollowup,statusLabel,holidayTemplate,showTime,formatMinute,openPrint,print,printedItems,exportExcel,openIssues,gotoIssue,notify};
},mounted(){this._pointerController=FOFPointerDnD.install({root:document.getElementById('app'),getBlock:id=>this.allBlocks.find(b=>b.id===id),onPlace:(id,day,slot)=>this.place(id,day,slot),onPool:id=>this.returnPool(id)});this.pointerReady=!!this._pointerController;},beforeUnmount(){this._pointerController?.destroy();}};
createApp(FOFApp).mount('#app');
