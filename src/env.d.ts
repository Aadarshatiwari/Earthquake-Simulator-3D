/// <reference types="vite/client" />
declare module 'plotly.js-basic-dist-min' {
  const plotly: {
    react(element:HTMLElement, data:object[], layout:object, config:object):Promise<unknown>;
    purge(element:HTMLElement):void;
    Plots:{resize(element:HTMLElement):Promise<unknown>};
  };
  export default plotly;
}
