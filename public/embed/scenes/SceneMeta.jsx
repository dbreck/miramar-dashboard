// Scene 5 — Meta Watch: CPL up, but Remarketing came alive
function SceneMeta({ start = 30, end = 37 }) {
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
        const titleOp = clamp((localTime - 0.4) / 0.6, 0, 1);

        // CPL needle: 119 → 172, animates 1.0 → 2.4
        const cplT = Easing.easeOutCubic(clamp((localTime - 1.0) / 1.4, 0, 1));
        const cpl = 119 + (172 - 119) * cplT;

        // Side note: Remarketing  fade in at 3.4
        const sideOp = clamp((localTime - 3.4) / 0.5, 0, 1);
        const remT = Easing.easeOutCubic(clamp((localTime - 3.8) / 1.0, 0, 1));
        const remCpl = 60 * (1 - remT) + 60; // hold at 60
        const remVal = 60;

        // Closing
        const closeOp = clamp((localTime - 5.4) / 0.5, 0, 1) * (1 - Easing.easeInCubic(outT));

        // Arc geometry — semicircle from $0 to $250
        const cx = 280, cy = 220, r = 160;
        const rad = (val) => {
          const t = clamp(val / 250, 0, 1);
          return Math.PI - t * Math.PI; // from PI (left, $0) to 0 (right, $250)
        };
        const pt = (val) => ({
          x: cx + r * Math.cos(rad(val)),
          y: cy - r * Math.sin(rad(val)),
        });

        // Tick marks
        const ticks = [0, 50, 100, 150, 200, 250];

        // Needle from $119 (start) to current
        const needle = pt(cpl);

        // Old position marker
        const oldPt = pt(119);

        return (
          <div style={{position:'absolute', inset:0, background:paper, opacity, overflow:'hidden'}}>
            <div style={{position:'absolute', top:64, left:0, right:0, textAlign:'center', opacity:eyeOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:14, color:rose, letterSpacing:'0.42em', textTransform:'uppercase', marginRight:'-0.42em'}}>
                Chapter Four · Meta &nbsp;·&nbsp; The Watch Item
              </div>
            </div>

            <div style={{position:'absolute', top:110, left:0, right:0, textAlign:'center', opacity:titleOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:48, color:ox, lineHeight:1.1, fontWeight:400}}>
                Cost-per-lead crept <em style={{color:rose, fontStyle:'italic'}}>upward.</em>
              </div>
            </div>

            {/* Gauge */}
            <div style={{position:'absolute', left:140, top:230, opacity:clamp((localTime - 0.8)/0.4, 0, 1)}}>
              <svg width="560" height="320">
                {/* Arc track */}
                <path
                  d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                  fill="none" stroke={ash} strokeWidth="1.5" opacity="0.25"
                />
                {/* Active arc from $0 to current */}
                <path
                  d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${needle.x} ${needle.y}`}
                  fill="none" stroke={ox} strokeWidth="3" strokeLinecap="round"
                />
                {/* Ticks */}
                {ticks.map((v, i) => {
                  const a = rad(v);
                  const xo = cx + (r-8) * Math.cos(a);
                  const yo = cy - (r-8) * Math.sin(a);
                  const xi = cx + (r+6) * Math.cos(a);
                  const yi = cy - (r+6) * Math.sin(a);
                  const xl = cx + (r+24) * Math.cos(a);
                  const yl = cy - (r+24) * Math.sin(a);
                  return (
                    <g key={i}>
                      <line x1={xo} y1={yo} x2={xi} y2={yi} stroke={ash} strokeWidth="1"/>
                      <text x={xl} y={yl+4} textAnchor="middle" fontFamily="Work Sans" fontSize="10" fill={ash} letterSpacing="0.12em">${v}</text>
                    </g>
                  );
                })}

                {/* Old marker */}
                <circle cx={oldPt.x} cy={oldPt.y} r="5" fill={ash}/>
                <text x={oldPt.x - 14} y={oldPt.y - 14} textAnchor="end" fontFamily="Libre Caslon Display" fontSize="16" fill={ash}>$119</text>
                <text x={oldPt.x - 14} y={oldPt.y - 30} textAnchor="end" fontFamily="Work Sans" fontSize="9" fill={ash} letterSpacing="0.16em">WAS</text>

                {/* Needle */}
                <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={ox} strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx={cx} cy={cy} r="8" fill={ox}/>
                <circle cx={needle.x} cy={needle.y} r="6" fill={rose}/>

                {/* Live value */}
                <text x={cx} y={cy - 32} textAnchor="middle" fontFamily="Libre Caslon Display" fontSize="56" fill={ox} fontVariantNumeric="tabular-nums">
                  ${Math.round(cpl)}
                </text>
                <text x={cx} y={cy - 10} textAnchor="middle" fontFamily="Work Sans" fontSize="10" fill={ash} letterSpacing="0.32em">CPL · META</text>

                {/* Delta chip */}
                {cplT > 0.9 && (
                  <g opacity={clamp((cplT - 0.9)/0.1, 0, 1)}>
                    <rect x={cx - 50} y={cy + 14} width="100" height="26" fill="rgba(75,1,8,0.06)" stroke={ox}/>
                    <text x={cx} y={cy + 31} textAnchor="middle" fontFamily="Work Sans" fontSize="11" fill={ox} letterSpacing="0.16em" fontWeight="700">▲ 45%</text>
                  </g>
                )}
              </svg>
            </div>

            {/* RIGHT side — silver lining: Remarketing */}
            <div style={{position:'absolute', right:120, top:280, opacity:sideOp, width:280}}>
              <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:rose, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:700, marginRight:'-0.32em', marginBottom:18}}>
                But —
              </div>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:34, color:ox, lineHeight:1.15, marginBottom:18}}>
                Remarketing<br/>came alive.
              </div>
              <div style={{borderTop:`1px solid ${rose}`, paddingTop:20, display:'flex', gap:32, alignItems:'baseline'}}>
                <div>
                  <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:9, color:ash, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:600, marginBottom:6}}>Was</div>
                  <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:28, color:ash}}>0</div>
                  <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:9, color:ash, letterSpacing:'0.16em'}}>leads</div>
                </div>
                <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:24, color:rose}}>→</div>
                <div>
                  <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:9, color:ox, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:700, marginBottom:6}}>Now</div>
                  <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:36, color:ox}}>{Math.round(4 * remT)}</div>
                  <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:9, color:ox, letterSpacing:'0.16em', fontWeight:600}}>leads · ${remVal} cpl</div>
                </div>
              </div>
            </div>

            {/* Closing */}
            <div style={{position:'absolute', bottom:48, left:0, right:0, textAlign:'center', opacity:closeOp}}>
              <div style={{fontFamily:'"Libre Baskerville", serif', fontStyle:'italic', fontSize:18, color:ink}}>
                Don't increase Meta budget until the trend corrects.
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

window.SceneMeta = SceneMeta;
