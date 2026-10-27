/* Local IndexedDB persistence. No remote service, network requests or credentials. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FOFLocalStore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
function open(indexedDB,name='fof-academic-workspace'){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,1);let rejected=false;
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('workspaces'))db.createObjectStore('workspaces');};
  request.onerror=()=>reject(request.error||Error('未能開啟本機資料庫'));
  request.onblocked=()=>{rejected=true;reject(Error('其他視窗阻擋本機資料庫更新，請關閉舊視窗後重開'));};
  request.onsuccess=()=>{const db=request.result;if(rejected){db.close();return;}db.onversionchange=()=>db.close();
   resolve({
    load(){return new Promise((res,rej)=>{let result;const tx=db.transaction('workspaces','readonly'),r=tx.objectStore('workspaces').get('current');r.onsuccess=()=>{result=r.result||null;};tx.oncomplete=()=>res(result);tx.onabort=()=>rej(tx.error||Error('未能讀取本機資料庫'));tx.onerror=()=>{};});},
    save(data,expectedRevision){return new Promise((res,rej)=>{let revision,error;const tx=db.transaction('workspaces','readwrite'),store=tx.objectStore('workspaces'),r=store.get('current');r.onsuccess=()=>{const old=r.result;if(old&&(old.revision||0)>expectedRevision){error=Error('另一視窗已更新，請先備份後重新載入');error.code='STALE';tx.abort();return;}revision=expectedRevision+1;store.put({data,revision,updatedAt:new Date().toISOString()},'current');};tx.oncomplete=()=>res(revision);tx.onabort=()=>rej(error||tx.error||Error('本機資料庫未能儲存'));tx.onerror=()=>{};});},
    close(){db.close();}
   });
  };
 });
}
return {open};
});
