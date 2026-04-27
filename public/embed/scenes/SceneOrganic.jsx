// Scene 4 — Organic Surge
// Two-up: rank climbing line chart (11.3 → 7.7) + impressions bars (4.2K → 8K).

function SceneOrganic({ start = 22, end = 30 }) {
  const ox = '#4B0108';
  const rose = '#A4515E';
  const paper = '#FFFDFB';
  const ash = '#65635F';
  const ink = '#161412';
  const dur = end - start;

  return (
    <Sprite start={start} end={end}>
      {({ localTime }) => {
        const inT = clamp(localTime / 0.5, 0, 1);
        const outT = clamp((localTime - (dur - 0.5)) / 0.5, 0, 1);
        const opacity = Easing.easeOutCubic(inT) * (1 - Easing.easeInCubic(outT));

        const eyeOp = clamp(localTime / 0.5, 0, 1);
        const titleOp = clamp((localTime - 0.5) / 0.6, 0, 1);

        // Rank line draws between 1.2s and 3.0s
        const lineT = Easing.easeOutCubic(clamp((localTime - 1.2) / 1.8, 0, 1));
        // Impressions bars 3.0s → 4.4s
        const beforeImpT = Easing.easeOutCubic(clamp((localTime - 3.0) / 0.7, 0, 1));
        const afterImpT  = Easing.easeOutCubic(clamp((localTime - 3.7) / 1.0, 0, 1));

        // Sub-stats
        const subOp = clamp((localTime - 5.0) / 0.5, 0, 1);

        // Closing
        const closeOp = clamp((localTime - 6.0) / 0.6, 0, 1) * (1 - Easing.easeInCubic(outT));

        // Line chart geometry: from (60, 220) [rank 11.3, low] to (440, 70) [rank 7.7, high]
        const x1 = 60, y1 = 220;
        const x2 = 440, y2 = 70;
        const xt = x1 + (x2 - x1) * lineT;
        const yt = y1 + (y2 - y1) * Easing.easeOutCubic(lineT);
        const rankNow = 11.3 + (7.7 - 11.3) * lineT;

        // Impressions
        const beforeImp = 4200 * beforeImpT;
        const afterImp = 8000 * afterImpT;
        const MAX_W = 280;

        return (
          <div style={{position:'absolute', inset:0, background: paper, opacity, overflow:'hidden'}}>
            {/* Eyebrow */}
            <div style={{position:'absolute', top:64, left:0, right:0, textAlign:'center', opacity:eyeOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:14, color:rose, letterSpacing:'0.42em', textTransform:'uppercase', marginRight:'-0.42em'}}>
                Chapter Three · Organic Search
              </div>
            </div>

            {/* Title */}
            <div style={{position:'absolute', top:110, left:0, right:0, textAlign:'center', opacity:titleOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:52, color:ox, lineHeight:1.1, fontWeight:400}}>
                Climbing into the <em style={{color:rose, fontStyle:'italic'}}>top ten.</em>
              </div>
            </div>

            {/* Two panels */}
            <div style={{position:'absolute', top:240, left:0, right:0, display:'flex', justifyContent:'center', gap:80}}>

              {/* LEFT — Rank line chart */}
              <div style={{width:520, opacity:clamp((localTime - 1.0)/0.4, 0, 1)}}>
                <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ash, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:600, marginBottom:24, marginRight:'-0.32em'}}>
                  Average Search Position (lower = better)
                </div>
                <svg width="500" height="280" style={{display:'block'}}>
                  {/* Gridlines */}
                  <line x1="40" y1="40" x2="40" y2="240" stroke={ash} strokeWidth="0.5" opacity="0.4"/>
                  <line x1="40" y1="240" x2="480" y2="240" stroke={ash} strokeWidth="0.5" opacity="0.4"/>
                  {/* Rank labels */}
                  <text x="28" y="74" textAnchor="end" fontFamily="Work Sans" fontSize="10" fill={ash} letterSpacing="0.1em">7</text>
                  <text x="28" y="244" textAnchor="end" fontFamily="Work Sans" fontSize="10" fill={ash} letterSpacing="0.1em">12</text>

                  {/* "Top 10" zone */}
                  <line x1="40" y1="100" x2="480" y2="100" stroke={rose} strokeWidth="0.5" strokeDasharray="3,4" opacity="0.6"/>
                  <text x="475" y="94" textAnchor="end" fontFamily="Libre Baskerville" fontStyle="italic" fontSize="11" fill={rose}>top ten</text>

                  {/* Path from before → after */}
                  <line x1={x1} y1={y1} x2={xt} y2={yt} stroke={ox} strokeWidth="2.5" strokeLinecap="round"/>

                  {/* Start dot (faded) */}
                  <circle cx={x1} cy={y1} r="6" fill={ash} opacity="0.5"/>
                  <text x={x1} y={y1+24} textAnchor="middle" fontFamily="Libre Caslon Display" fontSize="18" fill={ash}>11.3</text>
                  <text x={x1} y={y1+40} textAnchor="middle" fontFamily="Work Sans" fontSize="9" fill={ash} letterSpacing="0.16em">LAST PERIOD</text>

                  {/* Moving dot */}
                  <circle cx={xt} cy={yt} r="7" fill={ox}/>
                  <circle cx={xt} cy={yt} r="14" fill={ox} opacity={0.18}/>

                  {/* End label appears near end */}
                  {lineT > 0.85 && (
                    <g opacity={clamp((lineT - 0.85)/0.15, 0, 1)}>
                      <text x={x2 + 14} y={y2 + 6} fontFamily="Libre Caslon Display" fontSize="32" fill={ox} fontWeight="400">7.7</text>
                      <text x={x2 + 14} y={y2 + 26} fontFamily="Work Sans" fontSize="9" fill={ox} letterSpacing="0.16em" fontWeight="600">NOW</text>
                    </g>
                  )}

                  {/* Live readout near moving dot */}
                  {lineT > 0.05 && lineT < 0.85 && (
                    <text x={xt} y={yt - 18} textAnchor="middle" fontFamily="Libre Caslon Display" fontSize="22" fill={ox}>
                      {rankNow.toFixed(1)}
                    </text>
                  )}
                </svg>
              </div>

              {/* RIGHT — Impressions */}
              <div style={{width:340, opacity:clamp((localTime - 2.8)/0.4, 0, 1)}}>
                <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ash, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:600, marginBottom:24, marginRight:'-0.32em'}}>
                  Search Impressions
                </div>
                {/* Before */}
                <div style={{marginBottom:28}}>
                  <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8}}>
                    <span style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ash, letterSpacing:'0.16em', textTransform:'uppercase'}}>Last</span>
                    <span style={{fontFamily:'"Libre Caslon Display", serif', fontSize:24, color:ash, fontVariantNumeric:'tabular-nums'}}>
                      {Math.round(beforeImp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{height:14, background:'rgba(101,99,95,0.1)', position:'relative'}}>
                    <div style={{position:'absolute', left:0, top:0, bottom:0, width:`${(beforeImp/8000)*MAX_W}px`, background:ash, opacity:0.7}}/>
                  </div>
                </div>
                {/* After */}
                <div>
                  <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8}}>
                    <span style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ox, letterSpacing:'0.16em', textTransform:'uppercase', fontWeight:700}}>Now</span>
                    <span style={{fontFamily:'"Libre Caslon Display", serif', fontSize:36, color:ox, fontVariantNumeric:'tabular-nums'}}>
                      {Math.round(afterImp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{height:14, background:'rgba(75,1,8,0.08)', position:'relative'}}>
                    <div style={{position:'absolute', left:0, top:0, bottom:0, width:`${(afterImp/8000)*MAX_W}px`, background:`linear-gradient(90deg, ${rose}, ${ox})`}}/>
                  </div>
                </div>

                {/* Sub-stat */}
                <div style={{marginTop:36, opacity:subOp, borderTop:`1px solid ${rose}`, paddingTop:24, opacity_:1}}>
                  <div style={{fontFamily:'"Libre Baskerville", serif', fontStyle:'italic', fontSize:18, color:ink, lineHeight:1.5, opacity:subOp}}>
                    Up <span style={{color:ox, fontStyle:'normal', fontWeight:700}}>76%</span>. Queries up <span style={{color:ox, fontStyle:'normal', fontWeight:700}}>52%</span>.
                  </div>
                </div>
              </div>
            </div>

            {/* Closing */}
            <div style={{position:'absolute', bottom:56, left:0, right:0, textAlign:'center', opacity:closeOp}}>
              <div style={{fontFamily:'"Libre Baskerville", serif', fontStyle:'italic', fontSize:20, color:ink}}>
                Mira Mar is showing up — and people are searching.
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

window.SceneOrganic = SceneOrganic;
