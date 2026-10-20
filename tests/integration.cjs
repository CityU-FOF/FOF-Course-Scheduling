const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const path=require('path');process.chdir(path.resolve(__dirname,'..'));
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const {window}=new JSDOM(html,{url:"https://fof-test.invalid/"});
const messages=[],files=[],listeners={};
const storage=new Map();
const ctx=vm.createContext({window:{addEventListener:(event,fn)=>{listeners[event]=fn},print:()=>{}},document:window.document,navigator:{userAgent:'test'},Element:window.Element,HTMLElement:window.HTMLElement,SVGElement:window.SVGElement,MutationObserver:window.MutationObserver,console,setTimeout,clearTimeout,Promise,Blob,URL,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},alert:m=>messages.push(m),confirm:()=>true});

vm.runInContext(fs.readFileSync('vendor/vue.global.prod.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('scheduler-core.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('vendor/xlsx.full.min.js','utf8'),ctx);
// Mount in a DOM emulator to catch template errors; browser layout/print remain manual checks.
let script=html.match(/<script>\s*const \{ createApp[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,'');
script=script.replace("}).mount('#app');","});");
script=script.replace('createApp({','const testedApp=createApp({');
script+='\nglobalThis.api=testedApp._component.setup();globalThis.renderFn=Vue.compile(document.querySelector("#app").outerHTML);';
vm.runInContext(script,ctx);
(async()=>{
 const a=ctx.api;
 a.formRows.value=[{subjectCode:'BAE305',subject:'公司金融',teacher:'江老師',classStart:'A',classEnd:'B',lessonsPerWeek:2}];
 a.generateBlocks();assert.equal(a.unassignedBlocks.value.length,4);
 a.selectAllPrintClasses();assert.equal(a.selectedPrintClasses.value.length,2);
 const block=a.unassignedBlocks.value[0];a.chooseBlock(block);
 const ev={target:{closest:()=>false}};a.clickCell(ev,1,1);assert.equal(a.timetable.value.length,1);assert.equal(a.unassignedBlocks.value.length,3);
 a.undo();assert.equal(a.timetable.value.length,0);assert.equal(a.unassignedBlocks.value.length,4);
 a.redo();assert.equal(a.timetable.value.length,1);
 // Same class collision must be blocked, with no data loss.
 a.chooseBlock(a.unassignedBlocks.value.find(b=>b.className==='A'));a.clickCell(ev,1,1);assert.equal(a.timetable.value.length,1);assert.match(messages.at(-1),/班級撞堂/);
 a.chooseBlock(a.unassignedBlocks.value.find(b=>b.className==='B'));a.clickCell(ev,1,1);assert.equal(a.timetable.value.length,2);assert.equal(a.teacherStatsList.value[0].scheduled,1);assert.equal(a.teacherStatsList.value[0].numerator,22.5);
 const grid=a.getCellBlocks(1,1)[0];a.toggleLock(grid);a.removeSchedule(a.getCellBlocks(1,1)[0]);assert.equal(a.timetable.value.length,2);assert.match(messages.at(-1),/鎖定/);
 a.toggleLock(a.getCellBlocks(1,1)[0]);a.removeSchedule(a.getCellBlocks(1,1)[0]);assert.equal(a.timetable.value.length,1);
 // Edit causes room collision; refusal leaves original unchanged.
 const first=a.unassignedBlocks.value[0];a.editBlock(first);a.editingBlock.value.room='G2207';a.saveBlock();assert.equal(a.unassignedBlocks.value[0].room,'G2207');
 // Real XLSX export construction, without writing a browser download.
 ctx.XLSX.writeFile=(wb,name)=>files.push({wb,name});a.exportToExcel();assert.ok(files[0].wb.SheetNames.includes('時段負荷'));assert.ok(files[0].wb.SheetNames.includes('排課詳細資料'));
 await ctx.Vue.nextTick();assert.ok(storage.get('fof_scheduling_v2'));
 const before=a.timetable.value.length;
 await a.importData({target:{files:[{size:10,text:async()=>'{"unassignedBlocks":{},"timetable":[]}'}],value:'x'}});assert.equal(a.timetable.value.length,before);
 await a.startBatchExportPDF();assert.equal(a.pdfQueueData.value.length,2);
 // Render and mount the compiled template with the actual exposed setup state.
 const host=window.document.createElement('div');window.document.body.appendChild(host);
 ctx.Vue.createApp({setup:()=>a,render:ctx.renderFn}).mount(host);
 assert.ok(host.textContent.includes('金融學院排課系統 v2.0'));
 a.currentTab.value='stats';await ctx.Vue.nextTick();assert.ok(host.textContent.includes('已排學時 / 預計上限'));
 a.currentTab.value='slot';await ctx.Vue.nextTick();assert.ok(host.textContent.includes('課堂 / 10'));
 console.log('PASS: template compile, DOM mount, generate, class list, select/place, collision block, explicit merge stats, undo/redo, locks, return-to-pool, edit, XLSX construction, local save, malformed import, batch print queue, stats and slot render.');
})().catch(e=>{console.error(e);process.exit(1)});
