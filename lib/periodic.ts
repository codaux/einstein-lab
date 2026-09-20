import { Point } from "./geometry";
import { Tile } from "./tiling";

const EPS = 1e-5;

export type Vector = { x:number; y:number };

export type PeriodicResult = {
  found: boolean;
  confidence: "none" | "suggestive" | "strong";
  u?: Vector;
  v?: Vector;
  repeatedTiles: number;
  testedVectors: number;
  reason: string;
};

function centroid(tile: Tile): Point {
  let x=0,y=0;
  for(const p of tile){x+=p.x;y+=p.y;}
  return {x:x/tile.length,y:y/tile.length};
}

function q(n:number){ return Math.round(n*1e5)/1e5; }
function pkey(p:Point){ return `${q(p.x)},${q(p.y)}`; }

function translatedShapeSignature(tile:Tile){
  const c=centroid(tile);
  const pts=tile.map(p=>({x:q(p.x-c.x),y:q(p.y-c.y)}));
  const rots:string[]=[];
  for(let s=0;s<pts.length;s++){
    rots.push(pts.map((_,i)=>{
      const p=pts[(i+s)%pts.length];
      return `${p.x},${p.y}`;
    }).join("|"));
  }
  return rots.sort()[0];
}

function cross(a:Vector,b:Vector){ return a.x*b.y-a.y*b.x; }
function len(a:Vector){ return Math.hypot(a.x,a.y); }

function vectorKey(v:Vector){ return `${q(v.x)},${q(v.y)}`; }

export function detectPeriodicTranslations(tiles:Tile[]):PeriodicResult{
  if(tiles.length<6){
    return {found:false,confidence:"none",repeatedTiles:0,testedVectors:0,reason:"Patch is too small for a meaningful translation test."};
  }

  const items=tiles.map(tile=>({tile,c:centroid(tile),sig:translatedShapeSignature(tile)}));
  const occupancy=new Map<string,Set<string>>();
  for(const it of items){
    const k=pkey(it.c);
    if(!occupancy.has(k)) occupancy.set(k,new Set());
    occupancy.get(k)!.add(it.sig);
  }

  const candidateMap=new Map<string,Vector>();
  for(let i=0;i<items.length;i++){
    for(let j=i+1;j<items.length;j++){
      if(items[i].sig!==items[j].sig) continue;
      const v={x:items[j].c.x-items[i].c.x,y:items[j].c.y-items[i].c.y};
      if(len(v)<EPS) continue;
      const direct = (v.x<0 || (Math.abs(v.x)<EPS && v.y<0)) ? {x:-v.x,y:-v.y} : v;
      candidateMap.set(vectorKey(direct),direct);
    }
  }

  const candidates=[...candidateMap.values()].sort((a,b)=>len(a)-len(b)).slice(0,80);

  const scoreVector=(v:Vector)=>{
    let matches=0;
    for(const it of items){
      const dest={x:it.c.x+v.x,y:it.c.y+v.y};
      if(occupancy.get(pkey(dest))?.has(it.sig)) matches++;
    }
    return matches;
  };

  const scored=candidates
    .map(v=>({v,matches:scoreVector(v)}))
    .filter(x=>x.matches>=2)
    .sort((a,b)=>b.matches-a.matches || len(a.v)-len(b.v));

  let bestPair:{u:Vector;v:Vector;score:number;minMatches:number}|null=null;
  for(let i=0;i<scored.length;i++){
    for(let j=i+1;j<scored.length;j++){
      const u=scored[i],v=scored[j];
      const area=Math.abs(cross(u.v,v.v));
      if(area<EPS*Math.max(1,len(u.v)*len(v.v))) continue;

      let gridMatches=0;
      for(const it of items){
        const du={x:it.c.x+u.v.x,y:it.c.y+u.v.y};
        const dv={x:it.c.x+v.v.x,y:it.c.y+v.v.y};
        const duv={x:it.c.x+u.v.x+v.v.x,y:it.c.y+u.v.y+v.v.y};
        const s=it.sig;
        if(
          occupancy.get(pkey(du))?.has(s) &&
          occupancy.get(pkey(dv))?.has(s) &&
          occupancy.get(pkey(duv))?.has(s)
        ) gridMatches++;
      }

      const pairScore=gridMatches*10+Math.min(u.matches,v.matches);
      if(!bestPair || pairScore>bestPair.score){
        bestPair={u:u.v,v:v.v,score:pairScore,minMatches:Math.min(u.matches,v.matches)};
      }
    }
  }

  if(!bestPair){
    const best=scored[0];
    return {
      found:false,
      confidence:best && best.matches>=3 ? "suggestive" : "none",
      u:best?.v,
      repeatedTiles:best?.matches ?? 0,
      testedVectors:candidates.length,
      reason:best && best.matches>=3
        ? "A repeated translation direction was found, but no independent second period was detected."
        : "No repeated two-dimensional translation lattice was detected in this patch."
    };
  }

  const repeated=Math.floor((bestPair.score-bestPair.minMatches)/10);
  const strong = repeated>=2 && bestPair.minMatches>=3;

  return {
    found:strong,
    confidence:strong ? "strong" : "suggestive",
    u:bestPair.u,
    v:bestPair.v,
    repeatedTiles:repeated,
    testedVectors:candidates.length,
    reason:strong
      ? "Two independent translation vectors repeat matching tile orientations across the finite patch."
      : "A possible pair of translation vectors was found, but repetition is not deep enough yet."
  };
}
