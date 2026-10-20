/* FOF scheduling domain rules. No network or browser dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FOFCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const defaults={weeks:15,academicMinutes:50,capacity:10};
  const text=x=>typeof x==='string'?x.trim():'';
  const cls=b=>JSON.stringify([b.program,b.grade,b.className]);
  const subject=b=>JSON.stringify([text(b.subjectCode).toUpperCase(),text(b.subject)]);
  const sameSubject=(a,b)=>subject(a)===subject(b);
  const session=i=>i.mergeId?JSON.stringify(['merge',i.day,i.slot,i.mergeId]):JSON.stringify(['block',i.block.id]);
  const minutes=slot=>{const [a,b]=slot.time.split('-').map(t=>{const [h,m]=t.split(':').map(Number);return h*60+m;});return b-a;};
  const round=n=>Math.round(n*100)/100;
  function validate(raw){
    if(!raw||!Array.isArray(raw.unassignedBlocks)||!Array.isArray(raw.timetable))throw Error('備份必須包含待排課池及課表陣列。');
    if(raw.schemaVersion!==undefined&&raw.schemaVersion!==2)throw Error('不支援此備份版本。');
    const ids=new Set();
    const block=b=>{
      if(!b||typeof b!=='object'||!['id','program','grade','className','subject','teacher'].every(k=>typeof b[k]==='string'&&b[k].trim()))throw Error('課程資料缺少有效 ID、課程、年級、班級、科目或教師。');
      if(ids.has(b.id))throw Error('備份有重複拼圖 ID：'+b.id);ids.add(b.id);
      for(const k of ['subjectCode','room'])if(b[k]!==undefined&&typeof b[k]!=='string')throw Error('科目編號／課室格式不正確。');
      if(b.locked!==undefined&&typeof b.locked!=='boolean')throw Error('鎖定狀態格式不正確。');
      return {id:b.id,program:text(b.program),grade:text(b.grade),className:text(b.className),subject:text(b.subject),subjectCode:text(b.subjectCode).toUpperCase(),teacher:text(b.teacher),room:text(b.room),locked:!!b.locked};
    };
    const unassignedBlocks=raw.unassignedBlocks.map(block);
    const timetable=raw.timetable.map(i=>{
      if(!i||!Number.isInteger(i.day)||i.day<1||i.day>7||!Number.isInteger(i.slot)||i.slot<1||i.slot>8)throw Error('排課星期或節次不正確。');
      if(i.mergeId!==undefined&&(typeof i.mergeId!=='string'||!i.mergeId.trim()))throw Error('合班 ID 格式不正確。');
      return {day:i.day,slot:i.slot,block:block(i.block),...(i.mergeId?{mergeId:i.mergeId}:{})};
    });
    const settings={...defaults,...raw.settings};
    if(!Number.isInteger(settings.weeks)||settings.weeks<1||settings.weeks>52||!Number.isFinite(settings.academicMinutes)||settings.academicMinutes<1||settings.academicMinutes>120||!Number.isInteger(settings.capacity)||settings.capacity<1||settings.capacity>1000)throw Error('週數、學時分鐘或時段上限不正確。');
    const groups=new Map();
    timetable.filter(i=>i.mergeId).forEach(i=>{const key=i.mergeId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
    for(const group of groups.values())if(group.some(i=>i.day!==group[0].day||i.slot!==group[0].slot||i.block.teacher!==group[0].block.teacher||!sameSubject(i.block,group[0].block)||i.block.room!==group[0].block.room)||new Set(group.map(i=>cls(i.block))).size!==group.length)throw Error('合班資料必須同時段、同教師、同科目、同課室及不同班級。');
    return {schemaVersion:2,unassignedBlocks,timetable,settings};
  }
  function conflicts(a,b){
    if(a.day!==b.day||a.slot!==b.slot)return [];
    const out=[];
    const merge=a.mergeId&&a.mergeId===b.mergeId&&sameSubject(a.block,b.block)&&a.block.teacher===b.block.teacher&&a.block.room===b.block.room;
    if(cls(a.block)===cls(b.block))out.push('班級撞堂');
    if(a.block.teacher===b.block.teacher&&!merge)out.push('教師撞堂');
    if(a.block.room&&a.block.room===b.block.room&&!merge)out.push('課室撞堂');
    return out;
  }
  function audit(timetable){const issues=[];for(let a=0;a<timetable.length;a++)for(let b=a+1;b<timetable.length;b++){const types=conflicts(timetable[a],timetable[b]);if(types.length)issues.push({a:timetable[a],b:timetable[b],types});}return issues;}
  function slotLoad(timetable,day,slot){const items=timetable.filter(i=>i.day===day&&i.slot===slot);return {classes:items.length,sessions:new Set(items.map(session)).size,rooms:new Set(items.map(i=>i.block.room).filter(Boolean)).size,missingRooms:items.filter(i=>!i.block.room).length};}
  function stats(pool,timetable,settings,slots){
    const teachers=new Map();
    const get=t=>{if(!teachers.has(t))teachers.set(t,{name:t,classes:new Set(),scheduled:0,pending:0,minutes:0});return teachers.get(t);};
    const label=b=>`${b.program} ${b.grade}${b.className} ${b.subjectCode} ${b.subject}`;
    pool.forEach(b=>{const s=get(b.teacher);s.classes.add(label(b));s.pending++;});
    const counted=new Set();
    timetable.forEach(i=>{const s=get(i.block.teacher);s.classes.add(label(i.block));const k=JSON.stringify([i.block.teacher,session(i)]);if(!counted.has(k)){counted.add(k);s.scheduled++;s.minutes+=minutes(slots.find(s=>s.num===i.slot));}});
    return [...teachers.values()].map(s=>({...s,classes:[...s.classes].sort(),clockHours:round(s.minutes*settings.weeks/60),numerator:round(s.minutes*settings.weeks/settings.academicMinutes),denominator:round((s.minutes+s.pending*75)*settings.weeks/settings.academicMinutes)})).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  }
  return {defaults,validate,conflicts,audit,slotLoad,stats,sameSubject,cls,session,minutes};
});
