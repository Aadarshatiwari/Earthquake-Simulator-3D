import {defineConfig,loadEnv} from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({mode})=>{
  const origin=loadEnv(mode,process.cwd(),'PUBLIC_SITE_URL').PUBLIC_SITE_URL;
  const shareImage=origin?new URL('brand/social-preview.png',origin.endsWith('/')?origin:origin+'/').href:'./brand/social-preview.png';
  return {base:'./',plugins:[tailwindcss(),{
    name:'share-image-url',
    transformIndexHtml(html){return html.replace('%SHARE_IMAGE%',shareImage.replaceAll('&','&amp;').replaceAll('"','&quot;'));}
  }]};
});
