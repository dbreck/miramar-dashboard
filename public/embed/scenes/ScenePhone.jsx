// Scene 6 — Phone fix: 8 missed calls → 2 missed calls
function ScenePhone({ start = 37, end = 43 }) {
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

        // Show 8 dots, fade to red. Then 6 of them turn green/cream one by one. Leaves 2 red.
        // Reveal dots from 1.0s to 1.8s
        // Resolve: 2.2s onward, dots 0..5 turn (over 2s)
        const reveal = clamp((localTime - 1.0) / 0.8, 0, 1);
        const dotsToShow = Math.floor(reveal * 8 + 0.0001);

        const closeOp = clamp((localTime - 4.6) / 0.5, 0, 1) * (1 - Easing.easeInCubic(outT));

        const dots = [];
        for (let i = 0; i < 8; i++) {
          const appearT = clamp((localTime - (1.0 + i*0.1)) / 0.3, 0, 1);
          const isResolved = i < 6;
          const resolveTime = 2.4 + i * 0.22;
          const resolveT = isResolved ? clamp((localTime - resolveTime) / 0.4, 0, 1) : 0;
          dots.push({appearT, resolveT, isResolved});
        }

        // Side stat counters
        const missedT = clamp((localTime - 2.2) / 2.0, 0, 1);
        const missedNow = Math.round(8 - 6 * missedT);
        const answerT = clamp((localTime - 2.4) / 1.8, 0, 1);
        const answerNow = Math.round(70 + 17 * answerT);

        return (
          <div style={{position:'absolute', inset:0, background:paper, opacity, overflow:'hidden'}}>
            <div style={{position:'absolute', top:64, left:0, right:0, textAlign:'center', opacity:eyeOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:14, color:rose, letterSpacing:'0.42em', textTransform:'uppercase', marginRight:'-0.42em'}}>
                Chapter Five · The Phones
              </div>
            </div>

            <div style={{position:'absolute', top:110, left:0, right:0, textAlign:'center', opacity:titleOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:48, color:ox, lineHeight:1.1, fontWeight:400}}>
                The missed-call problem, <em style={{color:rose, fontStyle:'italic'}}>essentially solved.</em>
              </div>
            </div>

            {/* Dots row centered */}
            <div style={{position:'absolute', left:'50%', top:280, transform:'translateX(-50%)', display:'flex', gap:32, alignItems:'center'}}>
              {dots.map((d, i) => {
                if (d.appearT === 0) return <div key={i} style={{width:72, height:72}}/>;
                const op = d.appearT;
                // Color: starts red (rose), if resolved fades to ash (answered)
                const filled = d.resolveT > 0.5 ? false : true;
                const ringScale = 1 + 0.3 * Math.sin(localTime * 6 + i) * (filled ? 1 : 0) * (i >= 6 ? 1 : 0);
                return (
                  <div key={i} style={{
                    width:72, height:72, borderRadius:'50%',
                    border: `2px solid ${filled ? ox : ash}`,
                    background: filled ? ox : 'transparent',
                    opacity: op,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative',
                    transform: `scale(${1 - 0.05 * d.resolveT})`,
                    transition: 'none',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={filled ? '#F3ECE7' : ash} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {/* Strike line for resolved missed→answered */}
                    {!filled && d.resolveT > 0 && (
                      <div style={{
                        position:'absolute', left:8, right:8, top:'50%',
                        height:1, background: ash, transformOrigin:'left center',
                        transform: `translateY(-0.5px) scaleX(${d.resolveT})`,
                      }}/>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Caption under dots */}
            <div style={{position:'absolute', left:'50%', top:380, transform:'translateX(-50%)', textAlign:'center', opacity:clamp((localTime - 1.4)/0.5, 0, 1)}}>
              <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ash, letterSpacing:'0.28em', textTransform:'uppercase', marginRight:'-0.28em'}}>
                Each circle · one missed call last period
              </div>
            </div>

            {/* Stats */}
            <div style={{position:'absolute', bottom:120, left:0, right:0, display:'flex', justifyContent:'center', gap:120}}>
              <div style={{textAlign:'center', opacity:clamp((localTime - 2.2)/0.5, 0, 1)}}>
                <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ash, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:600, marginRight:'-0.32em', marginBottom:14}}>
                  Missed Calls
                </div>
                <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:72, color:ox, lineHeight:1, fontVariantNumeric:'tabular-nums'}}>
                  {missedNow}
                </div>
                <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ox, letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:600, marginTop:10, marginRight:'-0.18em'}}>
                  ▼ from 8
                </div>
              </div>
              <div style={{textAlign:'center', opacity:clamp((localTime - 2.6)/0.5, 0, 1)}}>
                <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ash, letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:600, marginRight:'-0.32em', marginBottom:14}}>
                  Answer Rate
                </div>
                <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:72, color:ox, lineHeight:1, fontVariantNumeric:'tabular-nums'}}>
                  {answerNow}%
                </div>
                <div style={{fontFamily:'"Work Sans", sans-serif', fontSize:11, color:ox, letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:600, marginTop:10, marginRight:'-0.18em'}}>
                  ▲ from 70%
                </div>
              </div>
            </div>

            <div style={{position:'absolute', bottom:48, left:0, right:0, textAlign:'center', opacity:closeOp}}>
              <div style={{fontFamily:'"Libre Baskerville", serif', fontStyle:'italic', fontSize:18, color:ink}}>
                Last period's fix is holding.
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

window.ScenePhone = ScenePhone;
