const {test}=require('node:test'),assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb'),S=require('../workspace-storage.js');
test('local database saves full snapshots independently of caller mutations and retains revision across reopen',async()=>{
 const idb=new IDBFactory(),a=await S.open(idb,'snapshots');assert.equal(await a.load(),null);const source={archives:[{term:'2025/2026'}],active:{name:'本學期'}};assert.equal(await a.save(source,7),8);source.archives[0].term='changed';a.close();const reopened=await S.open(idb,'snapshots'),saved=await reopened.load();assert.equal(saved.revision,8);assert.equal(saved.data.archives[0].term,'2025/2026');assert.equal(saved.data.active.name,'本學期');reopened.close();
});
test('two simultaneous writers cannot overwrite each other with the same expected revision',async()=>{
 const idb=new IDBFactory(),a=await S.open(idb,'cas'),b=await S.open(idb,'cas');const rs=await Promise.allSettled([a.save({owner:'A'},0),b.save({owner:'B'},0)]);assert.equal(rs.filter(r=>r.status==='fulfilled').length,1);assert.equal(rs.find(r=>r.status==='rejected').reason.code,'STALE');assert.equal((await a.load()).revision,1);assert.equal(await b.save({owner:'latest'},1),2);assert.equal((await a.load()).data.owner,'latest');a.close();b.close();
});
test('database can retain an archived workspace payload larger than the previous localStorage budget',async()=>{
 const idb=new IDBFactory(),s=await S.open(idb,'large');const payload={archives:[{fixture:'x'.repeat(6*1024*1024)}]};await s.save(payload,0);assert.equal((await s.load()).data.archives[0].fixture.length,6*1024*1024);s.close();
});
