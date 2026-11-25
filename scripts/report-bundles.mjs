import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync,brotliCompressSync} from 'node:zlib';

for(const folder of process.argv.slice(2)){
  const chunks=[];
  for(const file of await readdir(resolve(folder,'assets'))){
    if(!file.endsWith('.js'))continue;
    const data=await readFile(resolve(folder,'assets',file));
    chunks.push({file,bytes:data.length,gzip:gzipSync(data).length,brotli:brotliCompressSync(data).length});
  }
  chunks.sort((a,b)=>b.bytes-a.bytes);
  const sum=key=>chunks.reduce((total,item)=>total+item[key],0);
  console.log(JSON.stringify({folder,total:{bytes:sum('bytes'),gzip:sum('gzip'),brotli:sum('brotli')},chunks},null,2));
}
