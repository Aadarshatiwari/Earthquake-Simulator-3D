/** Retain first/last samples and both extrema per bucket in their original order. */
export function extremaIndices(length:number,value:(i:number)=>number,budget=2400):number[]{
  if(length<=budget)return Array.from({length},(_,i)=>i);
  const buckets=Math.max(1,Math.floor((budget-2)/2)),selected=[0];
  for(let b=0;b<buckets;b++){
    const start=1+Math.floor((length-2)*b/buckets);
    const end=1+Math.floor((length-2)*(b+1)/buckets);
    let lo=start,hi=start,min=value(start),max=min;
    for(let i=start+1;i<end;i++){
      const y=value(i);
      if(y<min){min=y;lo=i;}
      if(y>max){max=y;hi=i;}
    }
    selected.push(Math.min(lo,hi));
    if(lo!==hi)selected.push(Math.max(lo,hi));
  }
  selected.push(length-1);
  return selected;
}
