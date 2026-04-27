// Scene 8 — Sign-off
function SceneSignoff({ start = 53, end = 60 }) {
  const ox = '#4B0108';
  const cream = '#F3ECE7';
  const rose = '#A4515E';
  const burg = '#401516';
  const dur = end - start;

  return (
    <Sprite start={start} end={end}>
      {({ localTime }) => {
        const inT = clamp(localTime / 0.8, 0, 1);
        const outT = clamp((localTime - (dur - 0.7)) / 0.7, 0, 1);
        const opacity = Easing.easeOutCubic(inT) * (1 - Easing.easeInCubic(outT));

        // Slow camera push
        const camScale = 1 + 0.05 * Easing.easeOutCubic(clamp(localTime / dur, 0, 1));

        const ruleT = Easing.easeOutCubic(clamp((localTime - 0.6) / 0.8, 0, 1));
        const monoOp = clamp((localTime - 0.3) / 0.7, 0, 1);
        const wordOp = clamp((localTime - 1.0) / 0.8, 0, 1);
        const scriptOp = clamp((localTime - 1.8) / 1.0, 0, 1);
        const footOp = clamp((localTime - 3.0) / 0.6, 0, 1);

        return (
          <div style={{
            position:'absolute', inset:0,
            background:`radial-gradient(ellipse at 50% 50%, ${ox} 0%, #2a0508 100%)`,
            opacity, overflow:'hidden',
          }}>
            <div style={{position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%, rgba(164,81,94,0.25), transparent 55%)'}}/>
            <FilmGrain opacity={0.06}/>

            <div style={{
              position:'absolute', inset:0,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              transform:`scale(${camScale})`,
              transformOrigin:'50% 50%',
              textAlign:'center',
            }}>
              {/* Monogram */}
              <div style={{
                fontFamily:'"Libre Caslon Display", serif',
                fontSize:14, color:rose,
                letterSpacing:'0.5em', textTransform:'uppercase',
                opacity:monoOp,
                marginRight:'-0.5em',
                marginBottom:36,
                whiteSpace:'nowrap',
              }}>
                End of Report
              </div>

              {/* Wordmark */}
              <div style={{
                fontFamily:'"Libre Caslon Display", serif',
                fontSize:72, color:cream,
                letterSpacing:'0.22em', fontWeight:400,
                opacity:wordOp, lineHeight:1,
                marginRight:'-0.22em',
                whiteSpace:'nowrap',
              }}>
                MIRA MAR
              </div>

              {/* Hairline */}
              <div style={{
                width:160, height:1, background:rose,
                margin:'28px 0',
                transform:`scaleX(${ruleT})`, transformOrigin:'50% 50%',
              }}/>

              {/* Script */}
              <div style={{
                fontFamily:'"Pinyon Script", "Snell Roundhand", cursive',
                fontSize:88, color:cream, fontWeight:500, lineHeight:1,
                opacity:scriptOp,
              }}>
                Onward.
              </div>

              {/* Footer */}
              <div style={{
                marginTop:80,
                fontFamily:'"Work Sans", sans-serif',
                fontSize:11, color:'rgba(243,236,231,0.55)',
                letterSpacing:'0.32em', textTransform:'uppercase',
                opacity:footOp,
                marginRight:'-0.32em',
                whiteSpace:'nowrap',
              }}>
                Mar 27 — Apr 25, 2026 · Clear pH Design
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

window.SceneSignoff = SceneSignoff;
