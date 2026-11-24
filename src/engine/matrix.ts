export function finite(value:number,label:string,min=-Infinity,max=Infinity){
  if(!Number.isFinite(value)||value<min||value>max)throw new RangeError(label+' is outside its supported range.');
  return value;
}
export function chain(springs:Float64Array){
  const n=springs.length, matrix=new Float64Array(n*n);
  springs.forEach((k,i)=>{
    matrix[i*n+i]+=k;
    if(i){matrix[(i-1)*n+i-1]+=k;matrix[i*n+i-1]=-k;matrix[(i-1)*n+i]=-k;}
  });
  return matrix;
}
export function dot(a:Float64Array,b:Float64Array){
  let total=0;
  for(let i=0;i<a.length;i++)total+=a[i]*b[i];
  return total;
}
export function multiply(a:Float64Array,x:Float64Array,out:Float64Array){
  for(let i=0;i<x.length;i++){
    let value=0;
    for(let j=0;j<x.length;j++)value+=a[i*x.length+j]*x[j];
    out[i]=value;
  }
}
export function cholesky(matrix:Float64Array,n:number){
  const L=new Float64Array(n*n);
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let value=matrix[i*n+j];
    for(let k=0;k<j;k++)value-=L[i*n+k]*L[j*n+k];
    if(i===j&&(!(value>0)||!Number.isFinite(value)))throw new Error('Matrix is not numerically positive definite.');
    L[i*n+j]=i===j?Math.sqrt(value):value/L[j*n+j];
  }
  return (rhs:Float64Array,out:Float64Array)=>{
    for(let i=0;i<n;i++){
      let value=rhs[i];
      for(let j=0;j<i;j++)value-=L[i*n+j]*out[j];
      out[i]=value/L[i*n+i];
    }
    for(let i=n-1;i>=0;i--){
      let value=out[i];
      for(let j=i+1;j<n;j++)value-=L[j*n+i]*out[j];
      out[i]=value/L[i*n+i];
    }
  };
}
