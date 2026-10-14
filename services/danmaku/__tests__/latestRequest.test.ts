import { LatestDanmakuRequest } from '../latestRequest';
test('old episode completion after new episode does not overwrite the new result',async()=>{
 const requests=new LatestDanmakuRequest();let oldResolve!:(x:string)=>void;let newResolve!:(x:string)=>void;let visible='';
 const old=requests.start();const a=new Promise<string>(r=>oldResolve=r).then(x=>{if(old.isCurrent()) visible=x;});
 const current=requests.start();const b=new Promise<string>(r=>newResolve=r).then(x=>{if(current.isCurrent())visible=x;});
 expect(old.signal.aborted).toBe(true);newResolve('episode 2');await b;oldResolve('episode 1');await a;expect(visible).toBe('episode 2');
 requests.cancel();expect(current.signal.aborted).toBe(true);expect(current.isCurrent()).toBe(false);
});
