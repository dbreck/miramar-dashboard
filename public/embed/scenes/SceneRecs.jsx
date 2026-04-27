// Scene 7 — Five Recommendations
// A typed list, items appearing one at a time on a dark oxblood ground.

function SceneRecs({ start = 43, end = 53 }) {
  const ox = '#4B0108';
  const cream = '#F3ECE7';
  const rose = '#A4515E';
  const burg = '#401516';
  const ash = '#65635F';
  const dur = end - start;

  const recs = [
    { tag: 'High',        head: 'Pause Google Feeder Markets',    detail: '$1,468 spent for zero conversions. Two periods running. Redirect to Branded.' },
    { tag: 'High',        head: 'Diagnose Meta CPL increase',     detail: 'Up 45% to $172. Refresh creative around Video_Amenity. Hold the budget.' },
    { tag: 'Medium',      head: 'Capitalize on organic momentum', detail: 'Top-10 in search. Publish a monthly editorial cadence — neighborhood, lifestyle.' },
    { tag: 'Medium',      head: 'Document the Google win',        detail: 'Conversion rate doubled. Capture what changed before it\'s overwritten.' },
    { tag: 'Opportunity', head: 'Expand Meta Remarketing',        detail: '4 leads at $60 CPL. Modest budget shift should hold sub-$80.' },
  ];

  return (
    <Sprite start={start} end={end}>
      {({ localTime }) => {
        const inT = clamp(localTime / 0.6, 0, 1);
        const outT = clamp((localTime - (dur - 0.6)) / 0.6, 0, 1);
        const opacity = Easing.easeOutCubic(inT) * (1 - Easing.easeInCubic(outT));

        const eyeOp = clamp(localTime / 0.5, 0, 1);
        const titleOp = clamp((localTime - 0.4) / 0.6, 0, 1);

        return (
          <div style={{
            position:'absolute', inset:0,
            background:`linear-gradient(180deg, ${burg} 0%, ${ox} 100%)`,
            opacity, overflow:'hidden',
          }}>
            <div style={{position:'absolute', inset:0, background:'radial-gradient(ellipse at 100% 0%, rgba(164,81,94,0.22), transparent 50%)'}}/>
            <FilmGrain opacity={0.05}/>

            {/* Eyebrow */}
            <div style={{position:'absolute', top:64, left:96, opacity:eyeOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:14, color:rose, letterSpacing:'0.42em', textTransform:'uppercase', marginRight:'-0.42em'}}>
                Chapter Six · What Next
              </div>
            </div>

            {/* Title */}
            <div style={{position:'absolute', top:110, left:96, opacity:titleOp}}>
              <div style={{fontFamily:'"Libre Caslon Display", serif', fontSize:60, color:cream, lineHeight:1, fontWeight:400}}>
                Five <em style={{color:rose, fontStyle:'italic', fontFamily:'"Libre Baskerville", serif'}}>recommendations.</em>
              </div>
            </div>

            {/* List */}
            <div style={{position:'absolute', top:240, left:96, right:96, display:'flex', flexDirection:'column', gap:18}}>
              {recs.map((r, i) => {
                const t0 = 1.0 + i * 1.1;
                const t = localTime - t0;
                if (t < -0.3) return null;
                const itemOp = clamp(t / 0.45, 0, 1);
                const itemY = (1 - Easing.easeOutCubic(itemOp)) * 14;
                const ruleT = Easing.easeOutCubic(clamp(t / 0.6, 0, 1));

                return (
                  <div key={i} style={{
                    opacity: itemOp,
                    transform:`translateY(${itemY}px)`,
                    display:'grid',
                    gridTemplateColumns:'80px 140px 1fr 1fr',
                    gap:32,
                    alignItems:'baseline',
                    paddingTop:18,
                    position:'relative',
                  }}>
                    {/* Top hairline */}
                    <div style={{
                      position:'absolute', top:0, left:0, right:0, height:1,
                      background:rose, opacity:0.4,
                      transform:`scaleX(${ruleT})`, transformOrigin:'left center',
                    }}/>
                    {/* Number */}
                    <div style={{
                      fontFamily:'"Libre Caslon Display", serif',
                      fontSize:38, color:rose, lineHeight:1,
                    }}>
                      0{i+1}
                    </div>
                    {/* Tag */}
                    <div style={{
                      fontFamily:'"Work Sans", sans-serif', fontSize:10,
                      color: r.tag === 'High' ? '#f5a99c' : (r.tag === 'Medium' ? '#f0c860' : '#9ec9af'),
                      letterSpacing:'0.32em', textTransform:'uppercase', fontWeight:700,
                      marginRight:'-0.32em',
                      borderTop: `1px solid currentColor`, paddingTop:8,
                    }}>
                      {r.tag}
                    </div>
                    {/* Headline */}
                    <div style={{
                      fontFamily:'"Libre Caslon Display", serif',
                      fontSize:24, color:cream, lineHeight:1.2,
                    }}>
                      {r.head}
                    </div>
                    {/* Detail */}
                    <div style={{
                      fontFamily:'"Libre Baskerville", serif', fontStyle:'italic',
                      fontSize:14, color: 'rgba(243,236,231,0.75)', lineHeight:1.55,
                    }}>
                      {r.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

window.SceneRecs = SceneRecs;
