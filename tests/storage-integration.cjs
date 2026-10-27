const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb'),fs=require('fs'),assert=require('assert/strict'),S=require('../workspace-storage.js');
const until=async(fn)=>{const start=Date.now();while(!fn()){if(Date.now()-start>5000)throw Error('Timed out awaiting local persistence');await new Promise(r=>setTimeout(r,5));}};
async function load(idb,initial,{failOpen=false}={}){
 const w=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://storage-test.invalid/',runScripts:'outside-only'}).window;Object.defineProperty(w,'indexedDB',{value:idb});w.confirm=()=>true;w.print=()=>{};if(initial)w.localStorage.setItem('fof_scheduling_v3',JSON.stringify(initial));
 for(const f of ['vendor/vue.global.prod.js','vendor/xlsx.full.min.js','scheduler-core.js','workspace-storage.js','enrolment-import.js','holiday-data.js','ui-colors.js','vendor/papaparse.min.js','vendor/interact.min.js','pointer-dnd.js'])w.eval(fs.readFileSync(f,'utf8'));
 if(failOpen)w.FOFLocalStore.open=async()=>{throw Error('模擬無法開啟資料庫');};
 w.eval(fs.readFileSync('app.js','utf8').replace("createApp(FOFApp).mount('#app');","window.__app=createApp(FOFApp);window.__vm=window.__app.mount('#app');"));await until(()=>!!w.__vm);return w;
}
const close=w=>{w.FOFWorkspaceStore?.close();w.__app.unmount();w.close();};
(async()=>{
 const idb=new IDBFactory(),legacy={schemaVersion:8,revision:7,unassignedBlocks:[],timetable:[],settings:{semesterName:'舊版本機資料'}};let w=await load(idb,legacy),a=w.__vm;assert.equal(a.storageMode,'本機資料庫');a.openSettings();Object.assign(a.draft.termInfo,{academicYear:'2026/2027',semester:'上學期'});a.saveSettings();await until(()=>a.saveState==='已儲存');const marker=JSON.parse(w.localStorage.getItem('fof_scheduling_v3'));assert.equal(marker.indexedDB,true);assert.ok(marker.revision>7);assert.equal(marker.archives,undefined);const saved=JSON.stringify(a.data);close(w);
 w=await load(idb,marker);a=w.__vm;assert.equal(JSON.stringify(a.data),saved);assert.equal(a.data.settings.semesterName,'舊版本機資料');a.openNewTerm();a.saveNewTerm();await until(()=>a.saveState==='已儲存');const multi=JSON.stringify(a.data);const secondMarker=JSON.parse(w.localStorage.getItem('fof_scheduling_v3'));close(w);w=await load(idb,secondMarker);assert.equal(JSON.stringify(w.__vm.data),multi);assert.equal(w.__vm.data.archives.length,1);close(w);
 // A deliberate backup recovery made with fallback localStorage must win over an older IndexedDB record.
 const newer={...JSON.parse(multi),revision:100,settings:{...JSON.parse(multi).settings,semesterName:'較新的本機備份還原'}};w=await load(idb,newer);a=w.__vm;assert.equal(a.data.settings.semesterName,'較新的本機備份還原');a.openSettings();a.draft.capacity=12;a.saveSettings();await until(()=>a.saveState==='已儲存');assert.ok(JSON.parse(w.localStorage.getItem('fof_scheduling_v3')).revision>100);close(w);
 // A marker without readable database contents must not be treated as an empty workspace and saved over it.
 const badMarker={indexedDB:true,revision:123};w=await load(new IDBFactory(),badMarker,{failOpen:true});a=w.__vm;assert.ok(a.message.includes('自動儲存已暫停'));a.openSettings();a.draft.semesterName='不應自動覆寫';a.saveSettings();await w.Vue.nextTick();assert.deepEqual(JSON.parse(w.localStorage.getItem('fof_scheduling_v3')),badMarker);close(w);
 console.log('PASS IndexedDB integration: old localStorage migration, revision marker, multi-term reload, newer fallback recovery, unreadable-store preservation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
