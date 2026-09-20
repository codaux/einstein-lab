"use client";

import { useRef, useState } from "react";
import type { FinderResult } from "@/lib/finder";

function previewPoints(poly:{x:number;y:number}[]){
  if(!poly.length) return "";
  const minX=Math.min(...poly.map(p=>p.x)), maxX=Math.max(...poly.map(p=>p.x));
  const minY=Math.min(...poly.map(p=>p.y)), maxY=Math.max(...poly.map(p=>p.y));
  const w=Math.max(maxX-minX,1), h=Math.max(maxY-minY,1);
  return poly.map(p=>`${12+(p.x-minX)/w*76},${12+(p.y-minY)/h*76}`).join(" ");
}

export default function FinderPanel({onLoadShape,allowReflection}:{onLoadShape:(poly:{x:number;y:number}[])=>void;allowReflection:boolean}){
  const [family,setFamily]=useState<"polyomino"|"polykite">("polykite");
  const [cellCount,setCellCount]=useState(8);
  const [limit,setLimit]=useState(80);
  const [maxTiles,setMaxTiles]=useState(20);
  const [results,setResults]=useState<FinderResult[]>([]);
  const [progress,setProgress]=useState({phase:"shallow" as "shallow"|"deep",done:0,total:0});
  const [running,setRunning]=useState(false);
  const workerRef=useRef<Worker|null>(null);

  const start=()=>{
    workerRef.current?.terminate();
    const worker=new Worker(new URL("../workers/finder.worker.ts", import.meta.url));
    workerRef.current=worker;
    setRunning(true);
    setResults([]);
    setProgress({phase:"shallow",done:0,total:0});
    worker.onmessage=(event)=>{
      if(event.data.type==="progress") setProgress({phase:event.data.phase,done:event.data.done,total:event.data.total});
      if(event.data.type==="done"){
        setResults(event.data.results);
        setRunning(false);
        worker.terminate();
        workerRef.current=null;
      }
    };
    worker.onerror=()=>{
      setRunning(false);
      worker.terminate();
      workerRef.current=null;
    };
    worker.postMessage({family,cellCount,limit,allowReflection,maxTiles});
  };

  const stop=()=>{
    workerRef.current?.terminate();
    workerRef.current=null;
    setRunning(false);
  };

  const candidates=results.filter(r=>r.status==="candidate");
  const periodic=results.filter(r=>r.status==="periodic");
  const stalled=results.filter(r=>r.status==="stalled");

  return (
    <section className="panel finderPanel">
      <div className="panelHead">
        <div><span className="step">07</span><h2>Einstein Finder</h2></div>
        <div className="badge">square-grid polyomino search</div>
      </div>

      <div className="finderControls">
        <label><span>Family</span><select value={family} onChange={e=>{const v=e.target.value as "polyomino"|"polykite";setFamily(v);if(v==="polykite"&&cellCount<4)setCellCount(8);}}><option value="polykite">Polykite</option><option value="polyomino">Polyomino</option></select></label>
        <label><span>{family==="polykite" ? "Kites" : "Cells"}</span><input type="number" min="3" max="9" value={cellCount} onChange={e=>setCellCount(Math.max(3,Math.min(9,+e.target.value||3)))}/></label>
        <label><span>Candidate cap</span><input type="number" min="10" max="400" value={limit} onChange={e=>setLimit(Math.max(10,Math.min(400,+e.target.value||10)))}/></label>
        <label><span>Patch depth</span><input type="number" min="8" max="40" value={maxTiles} onChange={e=>setMaxTiles(Math.max(8,Math.min(40,+e.target.value||8)))}/></label>
        {!running ? <button className="run finderRun" onClick={start}>Search shapes</button> : <button className="ghost finderRun" onClick={stop}>Stop</button>}
      </div>

      {running && (
        <div className="finderProgress">
          <div><span>{progress.phase==="deep" ? "Deep-testing top candidates" : "Screening canonical shapes"}</span><b>{progress.done} / {progress.total||"…"}</b></div>
          <progress value={progress.done} max={Math.max(progress.total,1)}/>
        </div>
      )}

      {results.length>0 && (
        <>
          <div className="finderExport">
            <div><strong>Search complete</strong><span>{family} · {cellCount} units · reflection {allowReflection ? "allowed" : "off"}</span></div>
            <div>
              <button className="ghost" onClick={()=>{
                const blob=new Blob([JSON.stringify(results,null,2)],{type:"application/json"});
                const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`einstein-finder-${family}-${cellCount}.json`;a.click();URL.revokeObjectURL(a.href);
              }}>Export JSON</button>
              <button className="ghost" onClick={()=>{
                const rows=[["rank","id","family","units","score","status","patch","periodic_certified","periodic_confidence","hierarchy"]];
                results.forEach((r,i)=>rows.push([String(i+1),r.shape.id,r.shape.kind,String(r.shape.cellCount),String(r.score),r.status,String(r.patchSize),String(r.periodicCertified),r.periodicConfidence,r.hierarchyEvidence]));
                const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
                const blob=new Blob([csv],{type:"text/csv"});
                const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`einstein-finder-${family}-${cellCount}.csv`;a.click();URL.revokeObjectURL(a.href);
              }}>Export CSV</button>
            </div>
          </div>
          <div className="finderSummary">
            <div><b>{results.length}</b><span>tested</span></div>
            <div><b>{candidates.length}</b><span>candidates</span></div>
            <div><b>{periodic.length}</b><span>periodic rejected</span></div>
            <div><b>{stalled.length}</b><span>stalled</span></div>
          </div>

          <div className="candidateGrid">
            {results.slice(0,24).map((r,i)=>(
              <button className={`candidateCard ${r.status}`} key={r.shape.id} onClick={()=>onLoadShape(r.shape.polygon)}>
                <div className="candidateRank">#{i+1}</div>
                <svg viewBox="0 0 100 100"><polygon points={previewPoints(r.shape.polygon)}/></svg>
                <div className="candidateMeta">
                  <strong>Score {r.score}</strong>
                  <span>{r.patchSize} tile patch</span>
                  <span>period: {r.periodicCertified ? "certified" : r.periodicConfidence}</span>
                  <span>hierarchy: {r.hierarchyEvidence}</span>
                  <span>{r.deepTested ? "deep pass ✓" : "shallow pass"}</span>
                </div>
              </button>
            ))}
          </div>

          <p className="mathNote finderNote"><strong>Ranking is heuristic:</strong> score prioritizes shapes that grow larger patches, avoid a periodic certificate, and show repeated-cluster structure. It is not a probability of being an Einstein tile.</p>
        </>
      )}
    </section>
  );
}
