import { DanmakuScheduler, lowerBound, prepareTimeline } from '../timeline';
import { DEFAULT_DANMAKU_SETTINGS as defaults, DanmakuComment } from '../types';
const comment=(time:number,text='弹幕'+time):DanmakuComment=>({id:String(time)+text,time,text,color:'#ffffff',mode:'scroll'});
const clock=(position:number,playing=true,rate=1,buffering=false)=>({position,playing,rate,buffering});
describe('timeline and actual density',()=>{
 test.each([1,2,4,0])('fair sampling %s/sec spans each video time bucket',perSecond=>{
   const data=Array.from({length:100},(_,i)=>comment(i/100));const sampled=prepareTimeline(data,{...defaults,perSecond});
   expect(sampled).toHaveLength(perSecond||100);
   if(perSecond===2) expect(sampled.map(c=>c.time)).toEqual([0.25,0.75]);
 });
 test('duplicate filter has a finite 10-second video window',()=>{expect(prepareTimeline([comment(0,'a'),comment(1,'a'),comment(11,'a')],{...defaults,perSecond:0})).toHaveLength(2);});
 test('a delayed native status tick cannot emit two adjacent buckets over the per-video-second limit',()=>{
  const s=new DanmakuScheduler([comment(0.9),comment(0.95),comment(1.01),comment(1.1)],{...defaults,perSecond:2,maxOnScreen:24},1920,1080);
  s.update(clock(0.7));expect(s.update(clock(1.2))).toHaveLength(2);expect(s.update(clock(1.9))).toHaveLength(2);
 });
 test('fractional offsets sample by the shifted video second',()=>{
  const sampled=prepareTimeline([comment(0.2),comment(0.3),comment(0.7),comment(0.8)],{...defaults,perSecond:1,offset:0.5});
  expect(sampled.map(c=>c.time)).toEqual([0.3,0.8]);
 });
 test('independent simultaneous cap and exclusive lanes',()=>{
  const s=new DanmakuScheduler(Array.from({length:100},(_,i)=>comment(i/10)),{...defaults,perSecond:0,maxOnScreen:4},1920,1080);s.update(clock(0));const active=s.update(clock(1));
  expect(active.length).toBeLessThanOrEqual(4);expect(new Set(active.map(a=>a.lane)).size).toBe(active.length);
 });
 test('pause and buffering retain active comments, resume follows native time',()=>{
  const s=new DanmakuScheduler([comment(0),comment(1)],{...defaults,perSecond:0},1920,1080);
  const a=s.update(clock(0));expect(s.update(clock(0,false))).toEqual(a);expect(s.update(clock(0,true,1,true))).toEqual(a);expect(s.update(clock(1))).toHaveLength(2);
 });
 test.each([1.25,1.5,2])('speed %s follows video seconds, not wall time',rate=>{
  const s=new DanmakuScheduler([comment(1),comment(2)],{...defaults,perSecond:0},1920,1080);s.update(clock(0));expect(s.update(clock(1,true,rate))).toHaveLength(1);
 });
 test('seeks clear old comments and skip past comments; rewind indexes target only',()=>{
   const s=new DanmakuScheduler([comment(0),comment(1),comment(10),comment(11)],{...defaults,perSecond:0},1920,1080);
   s.update(clock(0));expect(s.update(clock(10)).map(a=>a.comment.time)).toEqual([10]);
   expect(s.update(clock(1)).map(a=>a.comment.time)).toEqual([1]);
 });
 test('episode/source replacement creates an independent scheduler',()=>{const a=new DanmakuScheduler([comment(0,'old')],defaults,1920,1080);a.update(clock(0));const b=new DanmakuScheduler([comment(0,'new')],defaults,1920,1080);expect(b.update(clock(0))[0].comment.text).toBe('new');});
 test('a comment at zero waits for a positive offset',()=>{const s=new DanmakuScheduler([comment(0)],{...defaults,offset:2},1920,1080);expect(s.update(clock(0))).toHaveLength(0);expect(s.update(clock(1))).toHaveLength(0);expect(s.update(clock(2))).toHaveLength(1);});
 test('positive offset delays, negative offset advances',()=>{const s=new DanmakuScheduler([comment(1)],{...defaults,offset:2},1920,1080);expect(s.update(clock(1))).toHaveLength(0);expect(s.update(clock(2))).toHaveLength(0);expect(s.update(clock(3))).toHaveLength(1);});
 test.each([100,1000,3000,10000])('%s comments are indexed and only a bounded pool is active',count=>{
   const data=Array.from({length:count},(_,i)=>comment(i/20));const start=performance.now();const s=new DanmakuScheduler(data,defaults,1920,1080);
   expect(lowerBound(data,25)).toBe(Math.min(count,500));for(let t=0;t<50;t+=0.25) expect(s.update(clock(t)).length).toBeLessThanOrEqual(4);
   expect(performance.now()-start).toBeLessThan(1500);
 });
});
