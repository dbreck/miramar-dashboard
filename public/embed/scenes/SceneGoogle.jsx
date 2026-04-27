// Scene 3 — Google Ads: the conversion rate doubled.
// Visual: a vertical bar that grows from 0.76% → 1.66%, the camera pushing in.

function SceneGoogle({ start = 13, end = 22 }) {
  const ox = '#4B0108';
  const cream = '#F3ECE7';
  const rose = '#A4515E';
  const paper = '#FFFDFB';
  const ash = '#65635F';
  const ink = '#161412';
  const burg = '#401516';
  const dur = end - start;

  return (
    <Sprite start={start} end={end}>
      {({ localTime }) => {
        const inT = clamp(localTime / 0.5, 0, 1);
        const outT = clamp((localTime - (dur - 0.5)) / 0.5, 0, 1);
        const opacity = Easing.easeOutCubic(inT) * (1 - Easing.easeInCubic(outT));

        // Eyebrow
        const eyeOp = clamp(localTime / 0.5, 0, 1);

        // Title
        const titleOp = clamp((localTime - 0.5) / 0.6, 0, 1);
        const titleY = (1 - Easing.easeOutCubic(titleOp)) * 18;

        // Two bars: BEFORE (0.76%) — grows from 1.0s to 2.0s
        // Then AFTER (1.66%) — grows from 2.6s to 3.8s — over twice as tall
        const beforeT = Easing.easeOutCubic(clamp((localTime - 1.0) / 1.0, 0, 1));
        const afterT  = Easing.easeOutCubic(clamp((localTime - 2.6) / 1.2, 0, 1));

        // Counters
        const beforeVal = 0.76 * beforeT;
        const afterVal  = 1.66 * afterT;

        // Side stats appear after bar grows
        const statsOp = clamp((localTime - 4.2) / 0.5, 0, 1);

        // Closing line
        const closeOp = clamp((localTime - 6.4) / 0.6, 0, 1) * (1 - Easing.easeInCubic(outT));

        // Max bar height in px
        const MAX_H = 380; // afterVal at full
        // Scale so 1.66 = MAX_H
        const px = (v) => (v / 1.66) * MAX_H;

        return (
          <div style={{
            position: 'absolute', inset: 0,
            background: paper,
            opacity,
            overflow: 'hidden',
          }}>
            {/* Eyebrow */}
            <div style={{
              position: 'absolute',
              top: 64, left: 0, right: 0,
              textAlign: 'center',
              opacity: eyeOp,
            }}>
              <div style={{
                fontFamily: '"Libre Caslon Display", serif',
                fontSize: 14,
                color: rose,
                letterSpacing: '0.42em',
                textTransform: 'uppercase',
                marginRight: '-0.42em',
              }}>
                Chapter Two · Google Ads
              </div>
            </div>

            {/* Title */}
            <div style={{
              position: 'absolute',
              top: 110, left: 0, right: 0,
              textAlign: 'center',
              opacity: titleOp,
              transform: `translateY(${titleY}px)`,
            }}>
              <div style={{
                fontFamily: '"Libre Caslon Display", serif',
                fontSize: 52,
                color: ox,
                lineHeight: 1.1,
                fontWeight: 400,
              }}>
                The conversion rate <em style={{color: rose, fontStyle: 'italic'}}>doubled.</em>
              </div>
            </div>

            {/* The bars — centered horizontally */}
            <div style={{
              position: 'absolute',
              left: '50%', top: 280,
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 140,
              alignItems: 'flex-end',
            }}>
              {/* BEFORE */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: 140,
                opacity: clamp((localTime - 0.8) / 0.4, 0, 1),
              }}>
                {/* Value */}
                <div style={{
                  fontFamily: '"Libre Caslon Display", serif',
                  fontSize: 42, color: ash,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  marginBottom: 14,
                  opacity: beforeT,
                }}>
                  {beforeVal.toFixed(2)}%
                </div>
                {/* Bar */}
                <div style={{
                  width: 100,
                  height: MAX_H,
                  background: 'transparent',
                  position: 'relative',
                  borderBottom: `1px solid ${ash}`,
                }}>
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: px(beforeVal),
                    background: `linear-gradient(180deg, ${ash} 0%, #8a8782 100%)`,
                  }}/>
                </div>
                {/* Label */}
                <div style={{
                  marginTop: 18,
                  fontFamily: '"Work Sans", sans-serif',
                  fontSize: 11,
                  color: ash,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginRight: '-0.28em',
                }}>
                  Last Period
                </div>
              </div>

              {/* AFTER */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: 140,
                opacity: clamp((localTime - 2.4) / 0.4, 0, 1),
              }}>
                <div style={{
                  fontFamily: '"Libre Caslon Display", serif',
                  fontSize: 56, color: ox,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  marginBottom: 14,
                  fontWeight: 400,
                  opacity: afterT,
                }}>
                  {afterVal.toFixed(2)}%
                </div>
                <div style={{
                  width: 100,
                  height: MAX_H,
                  background: 'transparent',
                  position: 'relative',
                  borderBottom: `1px solid ${ox}`,
                }}>
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: px(afterVal),
                    background: `linear-gradient(180deg, ${rose} 0%, ${ox} 100%)`,
                  }}/>
                </div>
                <div style={{
                  marginTop: 18,
                  fontFamily: '"Work Sans", sans-serif',
                  fontSize: 11,
                  color: ox,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginRight: '-0.28em',
                }}>
                  This Period
                </div>
              </div>
            </div>

            {/* Side stats — to the right of the bars */}
            <div style={{
              position: 'absolute',
              right: 110, top: 320,
              opacity: statsOp,
              display: 'flex', flexDirection: 'column',
              gap: 36,
              borderLeft: `1px solid ${rose}`,
              paddingLeft: 36,
            }}>
              <Stat label="Conversions" value="30" delta="▲ 43%" delta_color={ox}/>
              <Stat label="CPL" value="$231" delta="▼ 7%" delta_color={ox}/>
              <Stat label="CTR" value="8.3%" delta="▼ 17%" delta_color={ash}/>
            </div>

            {/* Closing italic */}
            <div style={{
              position: 'absolute',
              bottom: 56, left: 0, right: 0,
              textAlign: 'center',
              opacity: closeOp,
            }}>
              <div style={{
                fontFamily: '"Libre Baskerville", serif',
                fontStyle: 'italic',
                fontSize: 20,
                color: ink,
                maxWidth: 720,
                margin: '0 auto',
                lineHeight: 1.6,
              }}>
                A smaller audience — converting twice as efficiently.
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

function Stat({ label, value, delta, delta_color }) {
  return (
    <div>
      <div style={{
        fontFamily: '"Work Sans", sans-serif',
        fontSize: 10,
        color: '#65635F',
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginBottom: 8,
        marginRight: '-0.32em',
      }}>{label}</div>
      <div style={{
        fontFamily: '"Libre Caslon Display", serif',
        fontSize: 38,
        color: '#4B0108',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{
        fontFamily: '"Work Sans", sans-serif',
        fontSize: 11,
        color: delta_color,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginTop: 8,
        marginRight: '-0.18em',
      }}>{delta}</div>
    </div>
  );
}

window.SceneGoogle = SceneGoogle;
window.Stat = Stat;
