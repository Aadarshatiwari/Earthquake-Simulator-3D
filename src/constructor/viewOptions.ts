export const views=['Architectural','Structural skeleton','Wireframe','X-ray','Exploded','Section','Floor isolation','Material inspection','Mode shape'] as const;
export const cameras=['Perspective','Isometric','Front','Rear','Left','Right','Top','Foundation'] as const;
export const qualities=['Automatic','Low','Medium','High','Ultra'] as const;
export const environments=['Kathmandu neighbourhood','Himalayan village','Engineering lab','Architectural studio','Open terrain','Urban Nepal','Terai plains','Himalayan foothills'] as const;
export const lightings=['Daytime','Golden hour','Overcast','Neutral lab'] as const;
export type Options={view:typeof views[number];camera:typeof cameras[number];quality:typeof qualities[number];environment:typeof environments[number];lighting?:typeof lightings[number];floor:number;gap:number;clip:number;axis:'Width'|'Depth'|'Height';ghost:boolean;exaggeration:number;details:boolean};
