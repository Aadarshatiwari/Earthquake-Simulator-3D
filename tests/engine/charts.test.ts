import {describe,expect,it} from 'vitest';
import {extremaIndices} from '../../src/charts/sample';
describe('engineering plot sampling',()=>{
  it('retains signed peaks and both endpoints under the drawing budget',()=>{
    const values=new Float64Array(16000);
    values[355]=170;values[359]=-201;values[15555]=45;
    const indices=extremaIndices(values.length,i=>values[i],2000);
    expect(indices[0]).toBe(0);expect(indices.at(-1)).toBe(values.length-1);
    expect(indices).toEqual([...new Set(indices)].sort((a,b)=>a-b));
    expect(indices).toEqual(expect.arrayContaining([355,359,15555]));
    expect(indices.length).toBeLessThanOrEqual(2000);
  });
  it('retains every value in short series, including flat and empty input',()=>{
    expect(extremaIndices(4,()=>0)).toEqual([0,1,2,3]);
    expect(extremaIndices(0,()=>0)).toEqual([]);
  });
});
