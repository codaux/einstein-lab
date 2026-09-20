/// <reference lib="webworker" />

import { enumeratePolyominoes } from "../lib/generator";
import { enumeratePolykites } from "../lib/polykite";
import { rankFinderResults, screenShape } from "../lib/finder";

type Request = {
  family:"polyomino"|"polykite";
  cellCount:number;
  limit:number;
  allowReflection:boolean;
  maxTiles:number;
};

self.onmessage=(event:MessageEvent<Request>)=>{
  const {family,cellCount,limit,allowReflection,maxTiles}=event.data;
  const shapes=family==="polykite"
    ? enumeratePolykites(cellCount,limit)
    : enumeratePolyominoes(cellCount,limit);

  const shallowDepth=Math.min(maxTiles,16);
  const shallow=[];
  for(let i=0;i<shapes.length;i++){
    shallow.push(screenShape(shapes[i],allowReflection,shallowDepth,8,false));
    if(i%5===0 || i===shapes.length-1){
      self.postMessage({type:"progress",phase:"shallow",done:i+1,total:shapes.length});
    }
  }

  let ranked=rankFinderResults(shallow);
  const deepTargets=ranked.filter(r=>r.status==="candidate").slice(0,Math.min(20,ranked.length));
  const deepMap=new Map(ranked.map(r=>[r.shape.id,r]));

  if(maxTiles>shallowDepth && deepTargets.length){
    for(let i=0;i<deepTargets.length;i++){
      const r=deepTargets[i];
      deepMap.set(r.shape.id,screenShape(r.shape,allowReflection,maxTiles,18,true));
      self.postMessage({type:"progress",phase:"deep",done:i+1,total:deepTargets.length});
    }
    ranked=rankFinderResults([...deepMap.values()]);
  }

  self.postMessage({type:"done",results:ranked});
};

export {};
