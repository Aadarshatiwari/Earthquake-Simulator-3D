import type {System} from './solver';

export const experiments: {name:string;description:string;preset:string;comparison:System|null;motion:string}[]=[
  {name:'Watch a building sway',description:'Start with a six-storey concrete frame.',preset:'Concrete frame',comparison:null,motion:'Valley benchmark'},
  {name:'Compare base isolation',description:'Run the same motion on fixed and isolated frames.',preset:'Concrete frame',comparison:'Base isolation',motion:'Valley benchmark'},
  {name:'Test cross-bracing',description:'Compare two frames during a short, strong pulse.',preset:'Concrete frame',comparison:'Cross-bracing',motion:'Short strong pulse'},
  {name:'Explore brick masonry',description:'Inspect a low-rise illustrative model.',preset:'Brick masonry',comparison:null,motion:'Short strong pulse'},
];
