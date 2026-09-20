import { Point } from "./geometry";
import type { GeneratedShape } from "./generator";

type Kite = Point[];
const SQ3=Math.sqrt(3);
const EPS=1e-7;
const KEY_EPS=1e-3;

const BASE:Kite=[
  {x:0,y:0},
  {x:0.25,y:SQ3/4},
  {x:1,y:0},
  {x:0.25,y:-SQ3/4},
];

function snap(n:number){return Math.round(n/KEY_EPS)*KEY_EPS;}
function pkey(p:Point){return `${snap(p.x)},${snap(p.y)}`;}
function undirectedEdgeKey(a:Point,b:Point){
  const x=pkey(a),y=pkey(b);
  return x<y?`${x}|${y}`:`${y}|${x}`;
}
function kiteKey(k:Kite){
  return k.map(pkey).sort().join(";");
}

function reflectPoint(p:Point,a:Point,b:Point):Point{
  const dx=b.x-a.x,dy=b.y-a.y;
  const l2=dx*dx+dy*dy;
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  const proj={x:a.x+t*dx,y:a.y+t*dy};
  return {x:2*proj.x-p.x,y:2*proj.y-p.y};
}

function neighbor(k:Kite,edge:number):Kite{
  const a=k[edge],b=k[(edge+1)%k.length];
  return k.map(p=>reflectPoint(p,a,b));
}

function boundaryLoops(kites:Kite[]):Point[][]{
  const edges=new Map<string,{a:Point;b:Point}>();
  for(const k of kites){
    for(let i=0;i<k.length;i++){
      const a=k[i],b=k[(i+1)%k.length],key=undirectedEdgeKey(a,b);
      if(edges.has(key)) edges.delete(key);
      else edges.set(key,{a,b});
    }
  }

  const adj=new Map<string,Point[]>();
  for(const {a,b} of edges.values()){
    const ka=pkey(a),kb=pkey(b);
    const aa=adj.get(ka)??[];aa.push(b);adj.set(ka,aa);
    const bb=adj.get(kb)??[];bb.push(a);adj.set(kb,bb);
  }
  for(const ns of adj.values()) if(ns.length!==2) return [];

  const used=new Set<string>();
  const loops:Point[][]=[];
  for(const {a,b} of edges.values()){
    const ek=undirectedEdgeKey(a,b);
    if(used.has(ek)) continue;
    const loop:Point[]=[a];
    let prev=a,curr=b;
    used.add(ek);
    for(let guard=0;guard<edges.size+3;guard++){
      loop.push(curr);
      if(pkey(curr)===pkey(loop[0])) break;
      const ns=adj.get(pkey(curr))??[];
      const next=ns.find(n=>pkey(n)!==pkey(prev));
      if(!next) return [];
      used.add(undirectedEdgeKey(curr,next));
      prev=curr;curr=next;
    }
    if(pkey(loop[loop.length-1])===pkey(loop[0])) loop.pop();
    loops.push(loop);
  }
  return loops;
}

function simplify(poly:Point[]){
  const out:Point[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[(i-1+poly.length)%poly.length],b=poly[i],c=poly[(i+1)%poly.length];
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(Math.abs(cross)>EPS) out.push(b);
  }
  return out;
}

function boundarySignature(poly:Point[]){
  const tokens:string[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],c=poly[(i+2)%poly.length];
    const v1={x:b.x-a.x,y:b.y-a.y},v2={x:c.x-b.x,y:c.y-b.y};
    const length=Math.round(Math.hypot(v1.x,v1.y)*1000)/1000;
    const cross=v1.x*v2.y-v1.y*v2.x;
    const dot=v1.x*v2.x+v1.y*v2.y;
    const raw=Math.atan2(cross,dot)*180/Math.PI;
    const turn=Math.round(raw/30)*30;
    tokens.push(`${length}:${turn}`);
  }
  return tokens;
}

function cyclicKeys(poly:Point[]){
  const variants:string[]=[];
  const forms:Point[][]=[
    poly,
    [...poly].reverse(),
    poly.map(p=>({x:-p.x,y:p.y})),
    [...poly.map(p=>({x:-p.x,y:p.y}))].reverse(),
  ];
  for(const form of forms){
    const tokens=boundarySignature(form);
    for(let shift=0;shift<tokens.length;shift++){
      variants.push(tokens.map((_,i)=>tokens[(i+shift)%tokens.length]).join("|"));
    }
  }
  return variants;
}

function canonicalPolygonKey(poly:Point[]){
  return cyclicKeys(poly).sort()[0];
}

type State={kites:Kite[];polygon:Point[]};

export function enumeratePolykites(kiteCount:number,maxCandidates=1000):GeneratedShape[]{
  if(kiteCount<1) return [];
  let current=new Map<string,State>();
  current.set(canonicalPolygonKey(BASE),{kites:[BASE],polygon:BASE});

  for(let size=1;size<kiteCount;size++){
    const next=new Map<string,State>();
    for(const state of current.values()){
      const occupied=new Set(state.kites.map(kiteKey));
      const frontier=new Map<string,Kite>();
      for(const k of state.kites){
        for(let e=0;e<4;e++){
          const n=neighbor(k,e),key=kiteKey(n);
          if(!occupied.has(key)) frontier.set(key,n);
        }
      }

      for(const n of frontier.values()){
        const kites=[...state.kites,n];
        const loops=boundaryLoops(kites);
        // Einstein Lab currently restricts discovery to topological disks.
        // Polykites with holes therefore do not enter the search space.
        if(loops.length!==1) continue;
        const polygon=simplify(loops[0]);
        const key=canonicalPolygonKey(polygon);
        if(!next.has(key)) next.set(key,{kites,polygon});
        if(next.size>=maxCandidates*3) break;
      }
      if(next.size>=maxCandidates*3) break;
    }
    current=next;
  }

  return [...current.entries()].slice(0,maxCandidates).map(([id,s])=>({
    id,
    cells:[],
    polygon:s.polygon,
    cellCount:s.kites.length,
    kind:"polykite" as const,
  }));
}
