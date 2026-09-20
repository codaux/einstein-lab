import { GeneratedShape } from "./generator";
import { validatePolygon } from "./geometry";
import { growPatch } from "./tiling";
import { detectPeriodicTranslations } from "./periodic";
import { certifyFundamentalDomain } from "./fundamental";
import { detectHierarchy } from "./hierarchy";

export type FinderResult = {
  shape:GeneratedShape;
  valid:boolean;
  patchSize:number;
  periodicCertified:boolean;
  periodicConfidence:"none"|"suggestive"|"strong";
  hierarchyEvidence:"none"|"weak"|"moderate"|"strong";
  score:number;
  deepTested:boolean;
  status:"invalid"|"stalled"|"periodic"|"candidate";
};

export function screenShape(shape:GeneratedShape,allowReflection:boolean,maxTiles=24,beamWidth=10,deepTested=false):FinderResult{
  const v=validatePolygon(shape.polygon);
  if(!v.valid){
    return {shape,valid:false,patchSize:0,periodicCertified:false,periodicConfidence:"none",hierarchyEvidence:"none",score:-100,deepTested,status:"invalid"};
  }

  const patch=growPatch(shape.polygon,{maxTiles,allowReflection,beamWidth});
  if(patch.reached<6){
    return {shape,valid:true,patchSize:patch.reached,periodicCertified:false,periodicConfidence:"none",hierarchyEvidence:"none",score:patch.reached,deepTested,status:"stalled"};
  }

  const periodic=detectPeriodicTranslations(patch.sampleTiles);
  const cert=periodic.u&&periodic.v
    ? certifyFundamentalDomain(patch.sampleTiles,periodic.u,periodic.v)
    : null;
  const hierarchy=patch.reached>=12?detectHierarchy(patch.sampleTiles):null;

  const hScore={none:0,weak:6,moderate:14,strong:24}[hierarchy?.evidence??"none"];
  const pPenalty=cert?.certified?100:periodic.confidence==="strong"?22:periodic.confidence==="suggestive"?8:0;
  const score=Math.round(patch.reached*1.5+hScore-pPenalty);

  return {
    shape,
    valid:true,
    patchSize:patch.reached,
    periodicCertified:!!cert?.certified,
    periodicConfidence:periodic.confidence,
    hierarchyEvidence:hierarchy?.evidence??"none",
    score,
    deepTested,
    status:cert?.certified?"periodic":"candidate"
  };
}

export function rankFinderResults(results:FinderResult[]){
  return [...results].sort((a,b)=>b.score-a.score || b.patchSize-a.patchSize);
}
