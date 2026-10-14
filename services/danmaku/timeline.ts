import { DanmakuComment, DanmakuSettings } from './types';

export function lowerBound(comments: DanmakuComment[], time: number): number {
  let lo=0, hi=comments.length;
  while(lo<hi) { const mid=(lo+hi)>>>1; if(comments[mid].time<time) lo=mid+1; else hi=mid; }
  return lo;
}
/** Fair time-window sampling: pick across the entire bucket instead of its prefix. */
export function prepareTimeline(comments: DanmakuComment[], settings: DanmakuSettings): DanmakuComment[] {
  const filtered: DanmakuComment[]=[];
  const lastText=new Map<string,number>();
  for(const c of comments) {
    if(!settings[c.mode]) continue;
    const text=c.text.replace(/\s/g,'').toLowerCase();
    const last=lastText.get(text);
    if(settings.deduplicate && last!==undefined && c.time-last<10) continue;
    lastText.set(text,c.time); filtered.push(c);
  }
  if(settings.perSecond===0) return filtered;
  const result: DanmakuComment[]=[];
  for(let start=0;start<filtered.length;) {
    let end=start+1;const bucket=Math.floor(filtered[start].time+settings.offset);
    while(end<filtered.length && Math.floor(filtered[end].time+settings.offset)===bucket) end++;
    const count=Math.min(settings.perSecond,end-start);
    for(let i=0;i<count;i++) result.push(filtered[start+Math.floor((i+0.5)*(end-start)/count)]);
    start=end;
  }
  return result;
}
export interface ActiveDanmaku { comment: DanmakuComment; lane: number; start: number; end: number; width: number }
export interface VideoClock { position: number; playing: boolean; buffering: boolean; rate: number }
export class DanmakuScheduler {
  private cursor=0;
  private previous: number | null=null;
  private active: ActiveDanmaku[]=[];
  private displaySecond:number|null=null;
  private spawned=0;
  readonly comments: DanmakuComment[];
  constructor(comments: DanmakuComment[], readonly settings: DanmakuSettings,
    private width: number, private height: number) {
    this.comments=prepareTimeline(comments,settings);
  }
  reset(position=0) {this.active=[];this.previous=position;this.cursor=lowerBound(this.comments,position);this.displaySecond=null;this.spawned=0;}
  update(clock: VideoClock): ActiveDanmaku[] {
    // Positive offset delays comments. position is always derived from the native video clock.
    const position=clock.position-this.settings.offset;
    if(this.previous===null || position < this.previous-0.2 || position-this.previous>2) {
      this.reset(position);
    }
    if(!clock.playing || clock.buffering) {this.previous=position;return this.active;}
    const second=Math.floor(clock.position);
    if(second!==this.displaySecond){this.displaySecond=second;this.spawned=0;}
    this.active=this.active.filter(a=>a.end>position);
    const lines=Math.max(1,Math.floor(this.height*this.settings.area/(this.settings.fontSize*1.4)));
    const laneCount=lines;
    while(this.cursor<this.comments.length && this.comments[this.cursor].time<=position) {
      const c=this.comments[this.cursor++];
      if(position-c.time>0.75 || this.active.length>=this.settings.maxOnScreen) continue;
      if(this.settings.perSecond && this.spawned>=this.settings.perSecond)continue;
      // Exclusive occupied lanes avoid catch-up overlap even for mixed-length comments.
      const occupied=new Set(this.active.map(a=>a.lane));
      const lane=Array.from({length:laneCount},(_,i)=>c.mode==='bottom'?laneCount-1-i:i).find(i=>!occupied.has(i));
      if(lane===undefined) continue;
      const length=Array.from(c.text).reduce((sum,char)=>sum+(/[\u0000-\u00ff]/.test(char)?0.58:1.05),0);
      const width=Math.min(this.width*0.8,Math.ceil(length*this.settings.fontSize));
      this.active.push({comment:c,lane,start:c.time,end:c.time+(c.mode==='scroll'?this.settings.travelSeconds:4),width});
      this.spawned++;
    }
    this.previous=position;return [...this.active];
  }
  getPosition(clock: VideoClock) {return clock.position-this.settings.offset;}
}
