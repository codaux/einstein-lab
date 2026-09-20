"use client";

import { useMemo, useState } from "react";
import { Point, validatePolygon } from "@/lib/geometry";
import { growPatch, Tile } from "@/lib/tiling";
import { detectPeriodicTranslations, PeriodicResult } from "@/lib/periodic";
import { certifyFundamentalDomain, FundamentalCertificate } from "@/lib/fundamental";
import { detectHierarchy, HierarchyResult } from "@/lib/hierarchy";
import FinderPanel from "@/components/FinderPanel";

const GRID = 28;
const W = 720;
const H = 560;

const samples: Record<string, Point[]> = {
  square: [{x:5,y:5},{x:11,y:5},{x:11,y:11},{x:5,y:11}],
  triangle: [{x:6,y:12},{x:11,y:4},{x:16,y:12}],
  concave: [{x:5,y:5},{x:13,y:5},{x:13,y:8},{x:9,y:8},{x:9,y:12},{x:5,y:12}],
};

function polyPoints(poly: Point[]) {
  return poly.map(p => `${p.x*GRID},${p.y*GRID}`).join(" ");
}

function fitTiles(tiles: Tile[], width:number, height:number) {
  if (!tiles.length) return {tiles, scale:1, dx:0, dy:0};
  const pts = tiles.flat();
  const minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x));
  const minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
  const spanX=Math.max(maxX-minX,1), spanY=Math.max(maxY-minY,1);
  const scale=Math.min((width-50)/spanX,(height-50)/spanY);
  return {tiles, scale, dx:(width-spanX*scale)/2-minX*scale, dy:(height-spanY*scale)/2-minY*scale};
}

export default function Home() {
  const [points,setPoints]=useState<Point[]>(samples.concave);
  const [closed,setClosed]=useState(true);
  const [allowReflection,setAllowReflection]=useState(true);
  const [maxTiles,setMaxTiles]=useState(24);
  const [patch,setPatch]=useState<ReturnType<typeof growPatch>|null>(null);
  const [periodic,setPeriodic]=useState<PeriodicResult|null>(null);
  const [certificate,setCertificate]=useState<FundamentalCertificate|null>(null);
  const [hierarchy,setHierarchy]=useState<HierarchyResult|null>(null);

  const validation=useMemo(()=>closed ? validatePolygon(points) : null,[points,closed]);

  const clickGrid=(e:React.MouseEvent<SVGSVGElement>)=>{
    if (closed) return;
    const r=e.currentTarget.getBoundingClientRect();
    const x=Math.round(((e.clientX-r.left)/r.width*W)/GRID);
    const y=Math.round(((e.clientY-r.top)/r.height*H)/GRID);
    if (points.some(p=>p.x===x&&p.y===y)) return;
    setPoints([...points,{x,y}]);
    setPatch(null);
    setPeriodic(null);
    setCertificate(null);
    setHierarchy(null);
  };

  const run=()=>{
    if (!validation?.valid) return;
    const result=growPatch(points,{maxTiles,allowReflection,beamWidth:18});
    setPatch(result);
    const periodicResult=result.reached>=6 ? detectPeriodicTranslations(result.sampleTiles) : null;
    setPeriodic(periodicResult);
    if(periodicResult?.u && periodicResult?.v){
      setCertificate(certifyFundamentalDomain(result.sampleTiles,periodicResult.u,periodicResult.v));
    }else{
      setCertificate(null);
    }
    setHierarchy(result.reached>=12 ? detectHierarchy(result.sampleTiles) : null);
  };

  const reset=()=>{
    setPoints([]);
    setClosed(false);
    setPatch(null);
    setPeriodic(null);
    setCertificate(null);
    setHierarchy(null);
  };

  const load=(key:string)=>{
    setPoints(samples[key]);
    setClosed(true);
    setPatch(null);
    setPeriodic(null);
    setCertificate(null);
    setHierarchy(null);
  };

  const view=patch ? fitTiles(patch.sampleTiles,720,420) : null;
  const status = !closed ? "Draw a polygon" :
    !validation?.valid ? "Rejected before tiling search" :
    !patch ? "Ready to test" :
    patch.status==="grown" ? "Local tiling growth found" : "Search stalled";

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">COMPUTATIONAL GEOMETRY PLAYGROUND</div>
          <h1>Einstein Lab</h1>
          <p>Draw a straight-edged polygon, test local tileability, and inspect what the solver actually found.</p>
        </div>
        <div className="badge">MVP · polygon only</div>
      </header>

      <section className="layout">
        <div className="panel editorPanel">
          <div className="panelHead">
            <div>
              <span className="step">01</span>
              <h2>Polygon editor</h2>
            </div>
            <div className="toolbar">
              <button onClick={()=>load("square")}>Square</button>
              <button onClick={()=>load("triangle")}>Triangle</button>
              <button onClick={()=>load("concave")}>Concave</button>
              <button onClick={reset}>New</button>
            </div>
          </div>

          <svg className="editor" viewBox={`0 0 ${W} ${H}`} onClick={clickGrid}>
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="var(--grid)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
            {points.length>1 && (
              closed
                ? <polygon points={polyPoints(points)} className="shape"/>
                : <polyline points={polyPoints(points)} className="shape open"/>
            )}
            {points.map((p,i)=><g key={i}>
              <circle cx={p.x*GRID} cy={p.y*GRID} r="7" className="vertex"/>
              <text x={p.x*GRID+10} y={p.y*GRID-10} className="vertexLabel">{i+1}</text>
            </g>)}
          </svg>

          <div className="editorActions">
            <div className="hint">{closed ? "Polygon closed. Start a new shape to draw again." : "Click grid intersections to add vertices."}</div>
            <div className="buttons">
              {!closed && points.length>0 && <button className="ghost" onClick={()=>setPoints(points.slice(0,-1))}>Undo</button>}
              {!closed && points.length>=3 && <button className="primary" onClick={()=>setClosed(true)}>Close polygon</button>}
            </div>
          </div>
        </div>

        <aside className="panel inspector">
          <div className="panelHead compact">
            <div><span className="step">02</span><h2>Preflight</h2></div>
          </div>

          <div className={`statusCard ${validation?.valid ? "good" : "warn"}`}>
            <span className="statusDot"/>
            <div>
              <strong>{status}</strong>
              <small>{closed ? "Geometry checks run before the tiling solver." : "Finish the boundary first."}</small>
            </div>
          </div>

          <dl className="metrics">
            <div><dt>Vertices</dt><dd>{points.length}</dd></div>
            <div><dt>Area</dt><dd>{validation ? validation.area.toFixed(2) : "—"}</dd></div>
            <div><dt>Self intersection</dt><dd>{validation ? (validation.selfIntersects ? "Yes" : "No") : "—"}</dd></div>
            <div><dt>Reflection</dt><dd>{allowReflection ? "Allowed" : "Off"}</dd></div>
          </dl>

          {validation && validation.reasons.length>0 && (
            <div className="issues">
              <strong>Rejected because</strong>
              {validation.reasons.map((r,i)=><p key={i}>{r}</p>)}
            </div>
          )}

          {validation?.valid && (
            <>
              <div className="angles">
                <strong>Interior angles</strong>
                <div>{validation.angles.map((a,i)=><span key={i}>{a.toFixed(1)}°</span>)}</div>
              </div>
              <label className="switchRow">
                <span>Allow mirrored copies</span>
                <input type="checkbox" checked={allowReflection} onChange={e=>setAllowReflection(e.target.checked)}/>
              </label>
              <label className="rangeRow">
                <span>Growth target <b>{maxTiles} tiles</b></span>
                <input type="range" min="6" max="50" value={maxTiles} onChange={e=>setMaxTiles(+e.target.value)}/>
              </label>
              <button className="run" onClick={run}>Run local tiling test</button>
            </>
          )}
        </aside>
      </section>

      <section className="panel results">
        <div className="panelHead">
          <div><span className="step">03</span><h2>Solver result</h2></div>
          {patch && <div className="resultPill">{patch.status==="grown" ? "growth found" : "stalled"}</div>}
        </div>

        {!patch ? (
          <div className="emptyState">
            <div className="emptyGlyph">⌁</div>
            <h3>No search yet</h3>
            <p>The first MVP deliberately answers a narrower question: can copies of this polygon grow into a non-overlapping edge-to-edge patch?</p>
          </div>
        ) : (
          <div className="resultGrid">
            <svg className="tilingView" viewBox="0 0 720 420">
              {view?.tiles.map((t,i)=>
                <polygon key={i}
                  points={t.map(p=>`${p.x*view.scale+view.dx},${p.y*view.scale+view.dy}`).join(" ")}
                  className="tile"
                  style={{opacity:0.82+((i%3)*0.06)}}/>
              )}
            </svg>
            <div className="resultStats">
              <div><span>Tiles reached</span><b>{patch.reached}</b></div>
              <div><span>Placements tried</span><b>{patch.placementsTried.toLocaleString()}</b></div>
              <div><span>Dead-end branches</span><b>{patch.deadEnds}</b></div>
              <div className="interpretation">
                <strong>{patch.status==="grown" ? "Local compatibility found" : "No convincing growth found"}</strong>
                <p>{patch.status==="grown"
                  ? "This does not mean the polygon is an Einstein tile. It only survived the first constructive test."
                  : "This is evidence against tileability at the current search depth, not yet a mathematical proof."}</p>
              </div>
            </div>
          </div>
        )}

        <div className="periodicPanel">
          <div className="periodicHead">
            <div><span className="step">04</span><h2>Periodicity scan</h2></div>
            {periodic && <div className={`resultPill ${periodic.found ? "negative" : ""}`}>{periodic.found ? "periodic pattern found" : periodic.confidence}</div>}
          </div>
          {!periodic ? (
            <p className="periodicEmpty">Run a local tiling test first. The periodicity scanner needs a sufficiently large patch.</p>
          ) : (
            <div className="periodicBody">
              <div className="periodicVerdict">
                <strong>{periodic.found ? "Strong periodic rejection evidence" : periodic.confidence==="suggestive" ? "Possible translational repetition" : "No 2D period detected"}</strong>
                <p>{periodic.reason}</p>
              </div>
              <dl className="periodicMetrics">
                <div><dt>Vectors tested</dt><dd>{periodic.testedVectors}</dd></div>
                <div><dt>Repeated cells</dt><dd>{periodic.repeatedTiles}</dd></div>
                <div><dt>u</dt><dd>{periodic.u ? `(${periodic.u.x.toFixed(2)}, ${periodic.u.y.toFixed(2)})` : "—"}</dd></div>
                <div><dt>v</dt><dd>{periodic.v ? `(${periodic.v.x.toFixed(2)}, ${periodic.v.y.toFixed(2)})` : "—"}</dd></div>
              </dl>
              <p className="mathNote"><strong>Scope:</strong> this detects translational repetition inside the finite patch. A formal whole-plane fundamental-domain certificate is still a later solver stage.</p>
            </div>
          )}
        </div>

        <div className="certificatePanel">
          <div className="periodicHead">
            <div><span className="step">05</span><h2>Fundamental-domain certificate</h2></div>
            {certificate && <div className={`resultPill ${certificate.certified ? "negative" : ""}`}>{certificate.certified ? "CERTIFIED PERIODIC" : "not certified"}</div>}
          </div>
          {!certificate ? (
            <p className="periodicEmpty">A candidate pair of independent translation vectors is required before this test can run.</p>
          ) : (
            <div className="periodicBody">
              <div className="periodicVerdict">
                <strong>{certificate.certified ? "Periodic tiling certificate found" : "No periodic certificate from these vectors"}</strong>
                <p>{certificate.reason}</p>
              </div>
              <dl className="periodicMetrics">
                <div><dt>Cell area</dt><dd>{certificate.areaCell.toFixed(4)}</dd></div>
                <div><dt>Tile area / cell</dt><dd>{certificate.areaTiles.toFixed(4)}</dd></div>
                <div><dt>Area error</dt><dd>{certificate.areaError.toExponential(2)}</dd></div>
                <div><dt>Representatives</dt><dd>{certificate.representativeTiles.length}</dd></div>
                <div><dt>Overlap checks</dt><dd>{certificate.translationsChecked.toLocaleString()}</dd></div>
                <div><dt>Overlaps</dt><dd>{certificate.overlapsFound}</dd></div>
              </dl>
              <p className="mathNote"><strong>Meaning:</strong> when certified, the extracted tile representatives fill one translation cell by area and their periodic copies do not overlap. That is enough to reject the polygon as an Einstein candidate under the tested reflection setting.</p>
            </div>
          )}
        </div>

        <div className="certificatePanel">
          <div className="periodicHead">
            <div><span className="step">06</span><h2>Hierarchy evidence</h2></div>
            {hierarchy && <div className="resultPill">{hierarchy.evidence}</div>}
          </div>
          {!hierarchy ? (
            <p className="periodicEmpty">A larger patch is required before repeated-cluster analysis can run.</p>
          ) : (
            <div className="periodicBody">
              <div className="periodicVerdict">
                <strong>{hierarchy.evidence==="strong" ? "Substitution-like structure detected" : hierarchy.evidence==="moderate" ? "Repeated cluster structure detected" : "Limited hierarchy evidence"}</strong>
                <p>{hierarchy.reason}</p>
              </div>
              <dl className="periodicMetrics">
                <div><dt>Cluster candidates</dt><dd>{hierarchy.candidates.length}</dd></div>
                <div><dt>Strongest size</dt><dd>{hierarchy.strongest?.size ?? "—"}</dd></div>
                <div><dt>Occurrences</dt><dd>{hierarchy.strongest?.occurrences ?? "—"}</dd></div>
                <div><dt>Scale ratio</dt><dd>{hierarchy.strongest?.scaleRatio ?? "—"}</dd></div>
              </dl>
              <p className="mathNote"><strong>Meaning:</strong> this is structural evidence only. Repeated clusters and scale recurrence can point toward metatiles or substitution rules, but they are not by themselves a proof of aperiodicity.</p>
            </div>
          )}
        </div>

        <div className="roadmap">
          <div className="done"><span>✓</span><b>Geometry validity</b><small>implemented</small></div>
          <div className="done"><span>✓</span><b>Local patch growth</b><small>implemented</small></div>
          <div className="done"><span>✓</span><b>Periodic rejection</b><small>scan + certificate</small></div>
          <div className="done"><span>✓</span><b>Hierarchy evidence</b><small>cluster / scale analysis</small></div>
        </div>
      </section>

      <FinderPanel
        allowReflection={allowReflection}
        onLoadShape={(poly)=>{
          setPoints(poly);
          setClosed(true);
          setPatch(null);
          setPeriodic(null);
          setCertificate(null);
          setHierarchy(null);
          window.scrollTo({top:0,behavior:"smooth"});
        }}
      />

      <footer>
        <strong>Important:</strong> failure to find a periodic tiling is not a proof of aperiodicity. This lab reports exactly what was searched.
      </footer>
    </main>
  );
}
