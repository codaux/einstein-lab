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
  const results=[];
  for(let i=0;i<shapes.length;i++){
    results.push(screenShape(shapes[i],allowReflection,maxTiles));
    if(i%5===0 || i===shapes.length-1){
      self.postMessage({type:"progress",done:i+1,total:shapes.length});
    }
  }
  self.postMessage({type:"done",results:rankFinderResults(results)});
};

export {};
