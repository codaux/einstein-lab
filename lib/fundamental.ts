import { Point, signedArea } from "./geometry";
import { Tile } from "./tiling";
import { Vector } from "./periodic";
import { polygonsInteriorOverlap } from "./overlap";

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

function diameter(tile:Tile){
  let d=0;
  for(let i=0;i<tile.length;i++){
    for(let j=i+1;j<tile.length;j++){
      d=Math.max(d,Math.hypot(tile[i].x-tile[j].x,tile[i].y-tile[j].y));
    }
  }
  return d;
}

function coefficientBounds(u:Vector,v:Vector,maxTranslationLength:number){
  const det=Math.abs(cross(u,v));
  if(det<EPS) return {a:0,b:0};
  // Rows of B^-1 where B=[u v].  If ||t|| <= L then each
  // lattice coefficient is bounded by L times the corresponding row norm.
  const rowANorm=Math.hypot(v.y,-v.x)/det;
  const rowBNorm=Math.hypot(-u.y,u.x)/det;
  return {
    a:Math.ceil(maxTranslationLength*rowANorm)+1,
    b:Math.ceil(maxTranslationLength*rowBNorm)+1,
  };
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

  // If two periodic copies overlap, the distance between their centroids
  // is at most the sum of their circumstantial diameter bounds, <= 2D.
  // The inverse-basis norm converts that geometric bound into exhaustive
  // integer coefficient bounds for m*u+n*v.
  const bounds=coefficientBounds(u,v,2*maxDiameter+EPS);

  let overlapsFound=0;
  let translationsChecked=0;

  // It is sufficient to compare representatives in the reference cell
  // against every potentially intersecting lattice translate. Periodicity
  // makes all other cell-to-cell comparisons equivalent to one of these.
  for(let ra=0;ra<reps.length;ra++){
    for(let rb=0;rb<reps.length;rb++){
      for(let i=-bounds.a;i<=bounds.a;i++){
        for(let j=-bounds.b;j<=bounds.b;j++){
          if(ra===rb && i===0 && j===0) continue;
          // Avoid checking each unordered same-cell pair twice.
          if(i===0 && j===0 && rb<ra) continue;
          const shift={x:i*u.x+j*v.x,y:i*u.y+j*v.y};
          translationsChecked++;
          if(polygonsInteriorOverlap(reps[ra],shiftTile(reps[rb],shift.x,shift.y))){
            overlapsFound++;
            if(overlapsFound>10) break;
          }
        }
        if(overlapsFound>10) break;
      }
      if(overlapsFound>10) break;
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
      ? "The representative tiles have exactly one fundamental-cell area and all lattice translations capable of geometric intersection were exhaustively checked with no interior overlap."
      : areaError>areaTolerance
        ? "The representative tiles do not match the fundamental-cell area, so this pair of vectors does not define a complete periodic tiling certificate."
        : "At least one periodically translated tile overlaps another in its interior, so this lattice cannot certify a tiling."
  };
}
