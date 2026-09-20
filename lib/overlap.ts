import type { Point } from "./geometry";

export type Polygon = Point[];

const EPS = 1e-9;
const SNAP = 1e-9;

type Triangle = [Point, Point, Point];

function snap(n:number){
  return Math.round(n / SNAP) * SNAP;
}

function cleanPolygon(poly:Polygon):Polygon{
  const pts:Point[]=[];
  for(const p of poly){
    const q={x:snap(p.x),y:snap(p.y)};
    const last=pts[pts.length-1];
    if(!last || Math.hypot(q.x-last.x,q.y-last.y)>EPS) pts.push(q);
  }
  if(pts.length>1 && Math.hypot(pts[0].x-pts[pts.length-1].x,pts[0].y-pts[pts.length-1].y)<=EPS){
    pts.pop();
  }

  let changed=true;
  while(changed && pts.length>3){
    changed=false;
    for(let i=0;i<pts.length;i++){
      const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
      if(Math.abs(cross(a,b,c))<=EPS){
        pts.splice(i,1);
        changed=true;
        break;
      }
    }
  }
  return pts;
}

function cross(a:Point,b:Point,c:Point){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function signedArea(poly:Polygon){
  let s=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    s+=a.x*b.y-b.x*a.y;
  }
  return s/2;
}

function pointInTriangle(p:Point,a:Point,b:Point,c:Point){
  const c1=cross(a,b,p),c2=cross(b,c,p),c3=cross(c,a,p);
  const hasNeg=c1<-EPS||c2<-EPS||c3<-EPS;
  const hasPos=c1>EPS||c2>EPS||c3>EPS;
  return !(hasNeg&&hasPos);
}

function triangulate(input:Polygon):Triangle[]{
  let poly=cleanPolygon(input);
  if(poly.length<3) return [];
  if(signedArea(poly)<0) poly=[...poly].reverse();

  const idx=poly.map((_,i)=>i);
  const out:Triangle[]=[];
  let guard=0;

  while(idx.length>3 && guard++<poly.length*poly.length*4){
    let cut=false;
    for(let k=0;k<idx.length;k++){
      const ia=idx[(k-1+idx.length)%idx.length];
      const ib=idx[k];
      const ic=idx[(k+1)%idx.length];
      const a=poly[ia],b=poly[ib],c=poly[ic];

      if(cross(a,b,c)<=EPS) continue;

      let contains=false;
      for(const j of idx){
        if(j===ia||j===ib||j===ic) continue;
        if(pointInTriangle(poly[j],a,b,c)){
          contains=true;
          break;
        }
      }
      if(contains) continue;

      out.push([a,b,c]);
      idx.splice(k,1);
      cut=true;
      break;
    }
    if(!cut) break;
  }

  if(idx.length===3){
    const a=poly[idx[0]],b=poly[idx[1]],c=poly[idx[2]];
    if(Math.abs(cross(a,b,c))>EPS) out.push([a,b,c]);
  }

  return out;
}

function lineIntersection(s:Point,e:Point,a:Point,b:Point):Point{
  const rx=e.x-s.x, ry=e.y-s.y;
  const qx=a.x, qy=a.y;
  const sx=b.x-a.x, sy=b.y-a.y;
  const den=rx*sy-ry*sx;
  if(Math.abs(den)<=EPS) return {x:e.x,y:e.y};
  const t=((qx-s.x)*sy-(qy-s.y)*sx)/den;
  return {x:snap(s.x+t*rx),y:snap(s.y+t*ry)};
}

function insideEdge(p:Point,a:Point,b:Point){
  return cross(a,b,p)>=-EPS;
}

function clipConvex(subject:Polygon,clip:Triangle):Polygon{
  let output=subject;
  let clipPoly:Polygon=[...clip];
  if(signedArea(clipPoly)<0) clipPoly.reverse();

  for(let i=0;i<clipPoly.length;i++){
    const a=clipPoly[i],b=clipPoly[(i+1)%clipPoly.length];
    const input=output;
    output=[];
    if(!input.length) break;

    let s=input[input.length-1];
    for(const e of input){
      const eInside=insideEdge(e,a,b);
      const sInside=insideEdge(s,a,b);

      if(eInside){
        if(!sInside) output.push(lineIntersection(s,e,a,b));
        output.push(e);
      }else if(sInside){
        output.push(lineIntersection(s,e,a,b));
      }
      s=e;
    }
  }

  return cleanPolygon(output);
}

function area(poly:Polygon){
  return Math.abs(signedArea(poly));
}

function triangleIntersectionArea(a:Triangle,b:Triangle){
  return area(clipConvex([...a],b));
}

/**
 * Exact-for-our-domain positive-area overlap test for simple straight-edged polygons.
 * The polygons are triangulated first, so concavity is handled explicitly.
 * Shared edges and shared vertices have zero area and are allowed.
 */
export function intersectionArea(a:Polygon,b:Polygon){
  const ta=triangulate(a);
  const tb=triangulate(b);
  if(!ta.length||!tb.length) return 0;

  let total=0;
  for(const x of ta){
    for(const y of tb){
      total+=triangleIntersectionArea(x,y);
    }
  }
  return total;
}

export function polygonsInteriorOverlap(a:Polygon,b:Polygon,eps=1e-8){
  return intersectionArea(a,b)>eps;
}
