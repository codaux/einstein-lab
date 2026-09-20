import { Tile } from "./tiling";

export type ClusterCandidate = {
  size: number;
  occurrences: number;
  scaleRatio?: number;
  signature: string;
  tileIndices: number[];
};

export type HierarchyResult = {
  candidates: ClusterCandidate[];
  strongest?: ClusterCandidate;
  evidence: "none" | "weak" | "moderate" | "strong";
  reason: string;
};

function centroid(tile:Tile){
  let x=0,y=0;
  for(const p of tile){x+=p.x;y+=p.y;}
  return {x:x/tile.length,y:y/tile.length};
}

function q(n:number){ return Math.round(n*1e4)/1e4; }

function pairwiseSignature(indices:number[], centers:{x:number;y:number}[]){
  const pts=indices.map(i=>centers[i]);
  const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
  const cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  const dists:number[]=[];
  for(let i=0;i<pts.length;i++){
    for(let j=i+1;j<pts.length;j++){
      dists.push(q(Math.hypot((pts[i].x-cx)-(pts[j].x-cx),(pts[i].y-cy)-(pts[j].y-cy))));
    }
  }
  dists.sort((a,b)=>a-b);
  if(!dists.length) return "single";
  const max=dists[dists.length-1] || 1;
  return dists.map(d=>q(d/max)).join(",");
}

function nearestNeighbors(centers:{x:number;y:number}[], k:number){
  return centers.map((c,i)=>{
    return centers
      .map((p,j)=>({j,d:i===j?Infinity:Math.hypot(p.x-c.x,p.y-c.y)}))
      .sort((a,b)=>a.d-b.d)
      .slice(0,k)
      .map(x=>x.j);
  });
}

export function detectHierarchy(tiles:Tile[]):HierarchyResult{
  if(tiles.length<12){
    return {candidates:[],evidence:"none",reason:"Patch is too small for hierarchy analysis."};
  }

  const centers=tiles.map(centroid);
  const neighbors=nearestNeighbors(centers,8);
  const buckets=new Map<string,{count:number;sample:number[];diameter:number}>();

  for(let root=0;root<tiles.length;root++){
    for(const size of [3,4,5,6,7]){
      const idx=[root,...neighbors[root].slice(0,size-1)].sort((a,b)=>a-b);
      const sig=pairwiseSignature(idx,centers);
      const pts=idx.map(i=>centers[i]);
      let diameter=0;
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++) diameter=Math.max(diameter,Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y));
      const key=`${size}:${sig}`;
      const old=buckets.get(key);
      if(old) old.count++;
      else buckets.set(key,{count:1,sample:idx,diameter});
    }
  }

  const raw=[...buckets.entries()]
    .filter(([,v])=>v.count>=3)
    .map(([key,v])=>({key,...v}))
    .sort((a,b)=>b.count-a.count || b.diameter-a.diameter)
    .slice(0,12);

  const candidates:ClusterCandidate[]=raw.map((r,idx)=>{
    let scaleRatio:number|undefined;
    for(const other of raw){
      if(other===r) continue;
      const sameSize=other.sample.length===r.sample.length;
      if(!sameSize) continue;
      const ratio=other.diameter/r.diameter;
      if(ratio>1.35 && ratio<4){
        scaleRatio=q(ratio);
        break;
      }
    }
    return {
      size:r.sample.length,
      occurrences:r.count,
      scaleRatio,
      signature:r.key,
      tileIndices:r.sample
    };
  });

  const strongest=candidates[0];
  let evidence:HierarchyResult["evidence"]="none";
  let reason="No repeated cluster geometry was detected.";
  if(strongest){
    if(strongest.occurrences>=8 && candidates.some(c=>c.scaleRatio)){
      evidence="strong";
      reason="Repeated cluster geometry appears many times and a similar normalized pattern occurs at a larger scale, suggesting a substitution-like hierarchy.";
    }else if(strongest.occurrences>=6){
      evidence="moderate";
      reason="Several repeated local clusters were detected; this is useful structural evidence but not yet a hierarchy proof.";
    }else{
      evidence="weak";
      reason="Some repeated local clusters were found, but the evidence is still shallow.";
    }
  }

  return {candidates,strongest,evidence,reason};
}
