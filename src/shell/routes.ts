export const paths={
  Home:'home','Build & test':'build','Earthquake lab':'earthquake','Nepal archive':'archive','Protection Lab':'protection',
  Analytics:'analytics','Research Lab':'research',Learn:'learn','Saved projects':'projects',Settings:'settings',About:'about',
  Diagnostics:'diagnostics',Simulation:'simulation',
} as const;
export type Route=keyof typeof paths;
export type Locale='en'|'ne';
const nepali:Record<Route,string>={
  Home:'गृहपृष्ठ','Build & test':'भवन बनाउनुहोस्','Earthquake lab':'भूकम्प प्रयोगशाला','Nepal archive':'नेपाल भूकम्प अभिलेख',
  'Protection Lab':'संरक्षण प्रयोगशाला',Analytics:'विश्लेषण','Research Lab':'अनुसन्धान',Learn:'सिकाइ केन्द्र',
  'Saved projects':'सुरक्षित परियोजनाहरू',Settings:'सेटिङ',About:'परिचय',Diagnostics:'परीक्षण',Simulation:'अनुकरण',
};
export function resolveRoute(search:string):Route{
  const key=new URLSearchParams(search).get('view');
  return (Object.keys(paths) as Route[]).find(name=>paths[name]===key)??'Home';
}
export function routeUrl(route:Route,url:URL){
  const next=new URL(url);
  if(route==='Home')next.searchParams.delete('view');else next.searchParams.set('view',paths[route]);
  next.hash='';return next;
}
export function routeLabel(route:Route,locale:Locale){
  return locale==='ne'?nepali[route]:route==='Learn'?'Learning Centre':route;
}
export const primary=['Home','Build & test','Earthquake lab','Nepal archive','Protection Lab','Analytics'] as const;
export const secondary=['Research Lab','Learn','Saved projects','Settings','About','Diagnostics','Simulation'] as const;
export const icons:Record<Route,string>={
  Home:'M3 10 12 3l9 7v10h-6v-6H9v6H3z','Build & test':'M4 21V7l8-4v18M12 10h8v11M7 10v2m0 3v2m8-4h2m-2 4h2',
  'Earthquake lab':'M2 12h5l3-8 4 16 3-8h5','Nepal archive':'m3 17 6-10 4 5 3-7 5 12z','Protection Lab':'m12 3 8 3v5c0 5-3 8-8 10-5-2-8-5-8-10V6zM8 12l3 3 5-6',
  Analytics:'M4 4v16h16M7 15l4-5 4 2 5-6','Research Lab':'M9 3h6m-5 0v6l-6 9c-1 2 0 3 2 3h12c2 0 3-1 2-3l-6-9V3M8 15h8',
  Learn:'M3 5h6l3 2 3-2h6v14h-6l-3 2-3-2H3zM12 7v14','Saved projects':'M3 6h7l2 3h9v11H3z',Settings:'M12 5V2m0 20v-3M5 12H2m20 0h-3M5 5l2 2m10 10 2 2M5 19l2-2M19 5l-2 2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',About:'M12 10v7m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',Diagnostics:'M4 4h16v16H4zM7 12h3l2-5 2 10 2-5h2',Simulation:'M8 4l12 8-12 8z',
};
