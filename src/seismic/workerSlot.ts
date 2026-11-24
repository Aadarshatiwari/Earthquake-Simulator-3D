/** A single owner for worker lifetime. Closing clears ownership before termination. */
export class WorkerSlot<T extends {terminate:()=>void}> {
  private worker:T|null=null;
  take(worker:T){this.close();this.worker=worker;}
  owns(worker:T){return this.worker===worker;}
  close(){
    const previous=this.worker;
    this.worker=null;
    previous?.terminate();
  }
}
