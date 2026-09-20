import { Point } from "./geometry";
import type { GeneratedShape } from "./generator";

type Kite = Point[];
const SQ3=Math.sqrt(3);
const EPS=1e-6;
const BASE:Kite=[
  {x:0,y:0},
  {x:0.25,y:SQ3/4},
  {x:1,y:0},
  {x:0.25,y:-SQ3/4},
];

function q(n:number){return Math.round(n*1e6)/1e6;}
function pkey(p:Point){return `${q(p.x)},${q(p.y)}`;}
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
  return {x:q(2*proj.x-p.x),y:q(2*proj.y-p.y)};
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
  const points=new Map<string,Point>();
  for(const {a,b} of edges.values()){
    const ka=pkey(a),kb=pkey(b);
    points.set(ka,a);points.set(kb,b);
    const aa=adj.get(ka)??[];aa.push(b);adj.set(ka,aa);
    const bb=adj.get(kb)??[];bb.push(a);adj.set(kb,bb);
  }

  // A simple disk boundary has degree 2 at every boundary vertex.
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

function transformPoint(p:Point,angle:number,mirror:boolean){
  let x=mirror?-p.x:p.x,y=p.y;
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:q(x*c-y*s),y:q(x*s+y*c)};
}

function canonicalPolygonKey(poly:Point[]){
  const variants:string[]=[];
  for(const mirror of [false,true]){
    for(let r=0;r<12;r++){
      const angle=r*Math.PI/6;
      const pts=poly.map(p=>transformPoint(p,angle,mirror));
      const minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y));
      const norm=pts.map(p=>({x:q(p.x-minX),y:q(p.y-minY)}));
      for(const rev of [false,true]){
        const arr=rev?[...norm].reverse():norm;
        for(let shift=0;shift<arr.length;shift++){
          variants.push(arr.map((_,i)=>pkey(arr[(i+shift)%arr.length])).join(";"));
        }
      }
    }
  }
  return variants.sort()[0];
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
        // Restrict discovery to connected topological disks: one boundary loop.
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
