import { Point, signedArea } from "./geometry";
import { Tile } from "./tiling";
import { Vector } from "./periodic";

const EPS = 1e-6;

export type FundamentalCertificate = {
  certified: boolean;
  areaCell: number;
  areaTiles: number;
  areaError: number;
  representativeTiles: Tile[];
  translationsChecked: number;
  overlapsFound: number;
  u: Vector;
  v: Vector;
  reason: string;
};

function cross(a:Vector,b:Vector){ return a.x*b.y-a.y*b.x; }
function len(v:Vector){ return Math.hypot(v.x,v.y); }
function centroid(tile:Tile):Point{
  let x=0,y=0;
  for(const p of tile){x+=p.x;y+=p.y;}
  return {x:x/tile.length,y:y/tile.length};
}
function q(n:number){ return Math.round(n*1e5)/1e5; }

function toBasis(p:Point,u:Vector,v:Vector){
  const det=cross(u,v);
  return {
    a:(p.x*v.y-p.y*v.x)/det,
    b:(u.x*p.y-u.y*p.x)/det,
  };
}

function fromBasis(a:number,b:number,u:Vector,v:Vector):Point{
  return {x:a*u.x+b*v.x,y:a*u.y+b*v.y};
}

function frac(n:number){
  let r=n-Math.floor(n);
  if(Math.abs(r-1)<EPS || Math.abs(r)<EPS) r=0;
  return r;
}

function normalizedTileSignature(tile:Tile){
  const c=centroid(tile);
  const pts=tile.map(p=>({x:q(p.x-c.x),y:q(p.y-c.y)}));
  const variants:string[]=[];
  for(let s=0;s<pts.length;s++){
    variants.push(pts.map((_,i)=>{
      const p=pts[(i+s)%pts.length];
      return `${p.x},${p.y}`;
    }).join("|"));
  }
  return variants.sort()[0];
}

function representativeKey(tile:Tile,u:Vector,v:Vector){
  const c=centroid(tile);
  const bc=toBasis(c,u,v);
  return `${q(frac(bc.a))},${q(frac(bc.b))}::${normalizedTileSignature(tile)}`;
}

function shiftTile(tile:Tile,dx:number,dy:number):Tile{
  return tile.map(p=>({x:p.x+dx,y:p.y+dy}));
}

function properSegmentIntersection(a:Point,b:Point,c:Point,d:Point){
  const o=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const o1=o(a,b,c),o2=o(a,b,d),o3=o(c,d,a),o4=o(c,d,b);
  return ((o1>EPS&&o2<-EPS)||(o1<-EPS&&o2>EPS)) &&
         ((o3>EPS&&o4<-EPS)||(o3<-EPS&&o4>EPS));
}

function pointInPolygon(p:Point,poly:Tile){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    const hit=((a.y>p.y)!==(b.y>p.y)) &&
      (p.x < (b.x-a.x)*(p.y-a.y)/((b.y-a.y)||EPS)+a.x);
    if(hit) inside=!inside;
  }
  return inside;
}

function centroidSimple(poly:Tile){
  return centroid(poly);
}

function overlap(a:Tile,b:Tile){
  for(let i=0;i<a.length;i++){
    const a1=a[i],a2=a[(i+1)%a.length];
    for(let j=0;j<b.length;j++){
      const b1=b[j],b2=b[(j+1)%b.length];
      if(properSegmentIntersection(a1,a2,b1,b2)) return true;
    }
  }
  const ac=centroidSimple(a),bc=centroidSimple(b);
  if(pointInPolygon(ac,b)||pointInPolygon(bc,a)) return true;
  return false;
}

function diameter(tile:Tile){
  let d=0;
  for(let i=0;i<tile.length;i++){
    for(let j=i+1;j<tile.length;j++){
      d=Math.max(d,Math.hypot(tile[i].x-tile[j].x,tile[i].y-tile[j].y));
    }
  }
  return d;
}

export function certifyFundamentalDomain(
  patch:Tile[],
  u:Vector,
  v:Vector
):FundamentalCertificate{
  const areaCell=Math.abs(cross(u,v));
  if(areaCell<EPS){
    return {certified:false,areaCell,areaTiles:0,areaError:Infinity,representativeTiles:[],translationsChecked:0,overlapsFound:0,u,v,reason:"Translation vectors are not independent."};
  }

  const repsMap=new Map<string,Tile>();
  for(const tile of patch){
    const key=representativeKey(tile,u,v);
    if(!repsMap.has(key)){
      const c=centroid(tile);
      const bc=toBasis(c,u,v);
      const target=fromBasis(frac(bc.a),frac(bc.b),u,v);
      repsMap.set(key,shiftTile(tile,target.x-c.x,target.y-c.y));
    }
  }

  const reps=[...repsMap.values()];
  const areaTiles=reps.reduce((s,t)=>s+Math.abs(signedArea(t)),0);
  const areaError=Math.abs(areaTiles-areaCell);

  const maxDiameter=Math.max(...reps.map(diameter),0);
  const base=Math.max(Math.min(len(u),len(v)),EPS);
  const radius=Math.max(1,Math.ceil(maxDiameter/base)+2);

  let overlapsFound=0;
  let translationsChecked=0;

  const copies:{tile:Tile;ri:number;i:number;j:number}[]=[];
  for(let i=-radius;i<=radius;i++){
    for(let j=-radius;j<=radius;j++){
      const shift={x:i*u.x+j*v.x,y:i*u.y+j*v.y};
      for(let ri=0;ri<reps.length;ri++){
        copies.push({tile:shiftTile(reps[ri],shift.x,shift.y),ri,i,j});
      }
    }
  }

  for(let a=0;a<copies.length;a++){
    for(let b=a+1;b<copies.length;b++){
      const A=copies[a],B=copies[b];
      if(A.ri===B.ri && A.i===B.i && A.j===B.j) continue;
      translationsChecked++;
      if(overlap(A.tile,B.tile)){
        overlapsFound++;
        if(overlapsFound>10) break;
      }
    }
    if(overlapsFound>10) break;
  }

  const areaTolerance=Math.max(1e-5,areaCell*1e-5);
  const certified=areaError<=areaTolerance && overlapsFound===0;

  return {
    certified,
    areaCell,
    areaTiles,
    areaError,
    representativeTiles:reps,
    translationsChecked,
    overlapsFound,
    u,
    v,
    reason: certified
      ? "The representative tiles exactly fill one translation cell by area, and their periodic copies were verified non-overlapping across the required neighboring cells."
      : areaError>areaTolerance
        ? "The representative tiles do not match the fundamental-cell area, so this pair of vectors does not define a complete periodic tiling certificate."
        : "Periodic copies overlap, so this pair of translation vectors cannot certify a tiling."
  };
}
