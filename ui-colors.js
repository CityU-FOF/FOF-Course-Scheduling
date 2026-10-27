/* Presentation palette and explicit pressure states, separate from scheduling rules. */
(function(root,factory){const api=factory(typeof module==='object'?require('./scheduler-core.js'):root.FOFCore);if(typeof module==='object')module.exports=api;else root.FOFVisual=api;})(typeof globalThis!=='undefined'?globalThis:this,C=>{
 const palette=[
  {code:'BAECF',label:'應用經濟學學士',match:'應用經濟',accent:'#2563eb',bg:'#eaf3ff',ink:'#173d7c',border:'#8abaff'},
  {code:'MFICF',label:'金融學碩士',match:'金融學碩士',accent:'#9333ea',bg:'#f5eaff',ink:'#64218c',border:'#c898fb'},
  {code:'MFTBF',label:'金融科技碩士',match:'金融科技',accent:'#f97316',bg:'#fff0dd',ink:'#934007',border:'#f7b66a'},
  {code:'DFICF',label:'金融學博士',match:'金融學博士',accent:'#00a68c',bg:'#ddfbf1',ink:'#075f51',border:'#5adbb8'}
 ];
 function program(name){const known=C.programmeInfo(name);return palette.find(p=>p.code===known?.code)||palette.find(p=>String(name).includes(p.match))||{code:'OTHER',label:name||'其他課程',accent:'#5367c8',bg:'#eef0ff',ink:'#33438a',border:'#a5b2ed'};}
 function style(name){const p=program(name);return {'--course-accent':p.accent,'--course-bg':p.bg,'--course-ink':p.ink,'--course-border':p.border};}
 function assessment(p,registered,fallback,stage="confirmed"){
  const incomplete=!!(p.missingRooms||p.unregistered||p.unknownClasses||!registered);
  const ratio=Math.max(stage!=="planning"&&p.availableRooms?p.occupiedRooms/p.availableRooms:0,...p.rows.map(r=>r.ratio||0));
  let tone='healthy',label='資源充裕',reason='已登記教室及座位壓力較低';
  if(!p.sessions){tone='empty';label='尚無排課';reason='此時段沒有已排課堂';}
  else if(p.overRooms||p.conflictRooms){tone='danger';label=p.overRooms?'已超容量':'存在衝突';reason='請查看下方教室及課節明細';}
  else if(stage!=="planning"&&registered&&p.sessions>p.availableRooms){tone='danger';label='教室資源緊張';reason='課堂數多於已登記可用教室數，須核實資源';}
  else if(stage==='planning'&&incomplete){tone=ratio>=.8?'warn':'unknown';label=ratio>=.8?'指定課室接近容量':'時間規劃中';reason='人數及一般課室可待教務處指派／選科後補入';}
  else if(!registered){tone=p.sessions>=fallback?'danger':'unknown';label=tone==='danger'?'課量達提示線':'容量尚未登記';reason='尚不能判定實際座位是否足夠';}
  else if(ratio>=.8){tone='warn';label='接近滿載';reason='教室使用率或已知座位需求達80%';}
  else if(incomplete){tone='unknown';label='資料未齊';reason='仍有未填人數、課室或未登記容量';}
  return {tone,label,reason,incomplete,percent:Math.round(ratio*100)};
 }
 return {palette,program,style,assessment};
});
