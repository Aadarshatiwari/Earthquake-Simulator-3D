import {expect,it} from 'vitest';
import {mobileRoutes,paths,resolveRoute,routeLabel,routeUrl} from '../../src/shell/routes';
import type {Route} from '../../src/shell/routes';

it('round trips every workspace URL and preserves unrelated query parameters',()=>{
  const current=new URL('https://localhost/?profile=1&view=archive#workspace-content');
  for(const route of Object.keys(paths) as Route[]){
    const result=routeUrl(route,current);
    expect(resolveRoute(result.search)).toBe(route);
    expect(result.searchParams.get('profile')).toBe('1');
    expect(result.hash).toBe('');
    expect(routeLabel(route,'ne')).toMatch(/[\u0900-\u097f]/);
  }
  expect(resolveRoute('?view=unknown')).toBe('Home');
  expect(current.searchParams.get('view')).toBe('archive');
});


it('maps each primary mobile label to its existing workspace URL',()=>{
  const home=new URL('https://localhost/');
  expect(mobileRoutes.map(item=>item.en)).toEqual(['Home','Build','Simulate','Explore']);
  expect(mobileRoutes.map(item=>routeUrl(item.route,home).searchParams.get('view'))).toEqual([null,'build','earthquake','archive']);
  expect(mobileRoutes.every(item=>/[\u0900-\u097f]/.test(item.ne))).toBe(true);
});
