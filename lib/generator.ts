import { Point } from "./geometry";

export type Cell = {x:number;y:number};
export type GeneratedShape = {
  id:string;
  cells:Cell[];
  polygon:Point[];
  cellCount:number;
  kind:"polyomino"|"polykite";
};

const DIRS:Cell[]=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];

function cellKey(c:Cell){return `${c.x},${c.y}`;}

function normalizeCells(cells:Cell[]){
  const minX=Math.min(...cells.map(c=>c.x));
  const minY=Math.min(...cells.map(c=>c.y));
  return cells.map(c=>({x:c.x-minX,y:c.y-minY})).sort((a,b)=>a.x-b.x||a.y-b.y);
}

function transform(c:Cell,k:number):Cell{
  const {x,y}=c;
  switch(k){
    case 0:return {x,y};
    case 1:return {x:-y,y:x};
    case 2:return {x:-x,y:-y};
    case 3:return {x:y,y:-x};
    case 4:return {x:-x,y};
    case 5:return {x:y,y:x};
    case 6:return {x:x,y:-y};
    default:return {x:-y,y:-x};
  }
}

export function canonicalCellKey(cells:Cell[]){
  const variants:string[]=[];
  for(let k=0;k<8;k++){
    const n=normalizeCells(cells.map(c=>transform(c,k)));
    variants.push(n.map(cellKey).join(";"));
  }
  return variants.sort()[0];
}

function edgeKey(a:Point,b:Point){
  return `${a.x},${a.y}>${b.x},${b.y}`;
}

export function cellsToPolygon(cells:Cell[]):Point[]{
  const occupied=new Set(cells.map(cellKey));
  const directed:{a:Point;b:Point}[]=[];

  for(const c of cells){
    const x=c.x,y=c.y;
    if(!occupied.has(`${x},${y-1}`)) directed.push({a:{x,y},b:{x:x+1,y}});
    if(!occupied.has(`${x+1},${y}`)) directed.push({a:{x:x+1,y},b:{x:x+1,y:y+1}});
    if(!occupied.has(`${x},${y+1}`)) directed.push({a:{x:x+1,y:y+1},b:{x,y:y+1}});
    if(!occupied.has(`${x-1},${y}`)) directed.push({a:{x,y:y+1},b:{x,y}});
  }

  if(!directed.length) return [];
  const byStart=new Map<string,{a:Point;b:Point}[]>();
  for(const e of directed){
    const k=`${e.a.x},${e.a.y}`;
    const arr=byStart.get(k)??[];
    arr.push(e);byStart.set(k,arr);
  }

  const start=directed[0];
  const loop:Point[]=[start.a];
  let current=start;
  const used=new Set<string>();
  used.add(edgeKey(current.a,current.b));

  for(let guard=0;guard<directed.length+5;guard++){
    loop.push(current.b);
    if(current.b.x===start.a.x&&current.b.y===start.a.y) break;
    const options=byStart.get(`${current.b.x},${current.b.y}`)??[];
    const next=options.find(e=>!used.has(edgeKey(e.a,e.b)));
    if(!next) break;
    current=next;used.add(edgeKey(current.a,current.b));
  }

  loop.pop();
  // Remove collinear intermediate vertices.
  const out:Point[]=[];
  for(let i=0;i<loop.length;i++){
    const a=loop[(i-1+loop.length)%loop.length],b=loop[i],c=loop[(i+1)%loop.length];
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(Math.abs(cross)>1e-9) out.push(b);
  }
  return out;
}

export function enumeratePolyominoes(cellCount:number,maxCandidates=300):GeneratedShape[]{
  if(cellCount<1) return [];
  let current=new Map<string,Cell[]>();
  current.set("0,0",[{x:0,y:0}]);

  for(let size=1;size<cellCount;size++){
    const next=new Map<string,Cell[]>();
    for(const cells of current.values()){
      const occ=new Set(cells.map(cellKey));
      for(const c of cells){
        for(const d of DIRS){
          const n={x:c.x+d.x,y:c.y+d.y};
          if(occ.has(cellKey(n))) continue;
          const grown=[...cells,n];
          const key=canonicalCellKey(grown);
          if(!next.has(key)) next.set(key,normalizeCells(grown));
          if(next.size>=maxCandidates*4) break;
        }
        if(next.size>=maxCandidates*4) break;
      }
      if(next.size>=maxCandidates*4) break;
    }
    current=next;
  }

  return [...current.entries()].slice(0,maxCandidates).map(([id,cells])=>({
    id,cells,polygon:cellsToPolygon(cells),cellCount:cells.length,kind:"polyomino"
  }));
}
