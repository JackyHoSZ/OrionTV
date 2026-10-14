/** One video session owns results; late previous-episode responses cannot replace it. */
export class LatestDanmakuRequest {
  private version=0;
  private controller: AbortController | null=null;
  start() {
    this.cancel();
    const version=this.version;
    const controller=new AbortController();this.controller=controller;
    return {signal:controller.signal,isCurrent:()=>this.version===version&&!controller.signal.aborted};
  }
  cancel() {this.version++;this.controller?.abort();this.controller=null;}
}
