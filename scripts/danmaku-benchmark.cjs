/* Node-only repeatable scheduling benchmark. This is not a hardware video FPS test. */
const fs=require('fs');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {parseComments}=require('../services/danmaku/api.ts');
const {DanmakuScheduler}=require('../services/danmaku/timeline.ts');
const {DEFAULT_DANMAKU_SETTINGS:settings}=require('../services/danmaku/types.ts');
const results=[];
for(const count of [100,1000,3000,10000]){
 const raw={comments:Array.from({length:count},(_,i)=>({cid:i,p:`${i/50},1,16777215,fixture`,m:'模拟弹幕 '+i}))};
 const heapBefore=process.memoryUsage().heapUsed;const start=performance.now();const parsed=parseComments(raw);const parseMs=performance.now()-start;
 const indexStart=performance.now();const scheduler=new DanmakuScheduler(parsed.comments,settings,1920,1080);const indexMs=performance.now()-indexStart;
 const scheduleStart=performance.now();let maximum=0;
 for(let tick=0;tick<2000;tick++)maximum=Math.max(maximum,scheduler.update({position:tick/4,playing:true,buffering:false,rate:1}).length);
 const scheduleMs=performance.now()-scheduleStart;
 if(maximum>settings.maxOnScreen||parseMs>2000||scheduleMs>2000)throw new Error('Scheduling bound/performance regression');
 results.push({count,parseMs,indexMs,schedule2000TicksMs:scheduleMs,maximumActiveComments:maximum,nodeHeapDeltaBytes:process.memoryUsage().heapUsed-heapBefore});
}
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/benchmarks.json',JSON.stringify({environment:'Node.js, not Android decoder/FPS',results},null,2));
console.log(JSON.stringify(results));
