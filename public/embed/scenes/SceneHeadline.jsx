// Scene 2 — Headline Numbers
// "The period, in three numbers." Spend → Leads → CPL, each lands with weight.

function SceneHeadline({ start = 5, end = 13 }) {
  const ox = '#4B0108';
  const cream = '#F3ECE7';
  const rose = '#A4515E';
  const paper = '#FFFDFB';
  const ash = '#65635F';
  const ink = '#161412';
  const dur = end - start;

  return (
    <Sprite start={start} end={end}>
      {({ localTime }) => {
        // Global fade in/out
        const inT = clamp(localTime / 0.5, 0, 1);
        const outT = clamp((localTime - (dur - 0.5)) / 0.5, 0, 1);
        const opacity = Easing.easeOutCubic(inT) * (1 - Easing.easeInCubic(outT));

        // Eyebrow / chapter label
        const eyeOp = clamp(localTime / 0.6, 0, 1);

        // Three card timings — each appears, value counts up, then settles
        // Card 1: 0.6s → 2.4s
        // Card 2: 2.4s → 4.4s
        // Card 3: 4.4s → 6.4s
        const cards = [
          {
            label: 'Total Spend',
            value: 16164,
            display: (v) => '$' + Math.round(v).toLocaleString(),
            delta: '▼ 3.1% vs $16,681',
            deltaColor: '#3a7a4f',
            t0: 0.6,
          },
          {
            label: 'Total Leads',
            value: 70,
            display: (v) => Math.round(v).toString(),
            delta: '▲ 4.5% vs 67',
            deltaColor: '#3a7a4f',
            t0: 2.4,
          },
          {
            label: 'Cost per Lead',
            value: 231,
            display: (v) => '$' + Math.round(v),
            delta: '▼ 7.2% vs $249',
            deltaColor: '#3a7a4f',
            t0: 4.4,
          },
        ];

        return (
          <div style={{
            position: 'absolute', inset: 0,
            background: paper,
            opacity,
            overflow: 'hidden',
          }}>
            {/* Subtle paper grain */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 80% -10%, rgba(164,81,94,0.06), transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(75,1,8,0.04), transparent 50%)',
            }}/>

            {/* Top eyebrow */}
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
                Chapter One · The Period in Three Numbers
              </div>
              <div style={{
                width: 60, height: 1,
                background: rose,
                margin: '18px auto 0',
                opacity: 0.5,
              }}/>
            </div>

            {/* Three cards in a row */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              gap: 64,
              alignItems: 'flex-start',
            }}>
              {cards.map((c, i) => {
                const t = localTime - c.t0;
                if (t < 0) return <div key={i} style={{width:340}}/>;
                // Entry: rule scales, label fades, value counts up
                const ruleT = Easing.easeOutCubic(clamp(t / 0.5, 0, 1));
                const labelOp = clamp((t - 0.2) / 0.4, 0, 1);
                const countT = Easing.easeOutCubic(clamp((t - 0.4) / 1.0, 0, 1));
                const cardOp = clamp(t / 0.3, 0, 1);
                const deltaOp = clamp((t - 1.2) / 0.4, 0, 1);

                const animatedValue = c.value * countT;

                return (
                  <div key={i} style={{
                    width: 340,
                    opacity: cardOp,
                    textAlign: 'center',
                  }}>
                    {/* Top hairline */}
                    <div style={{
                      width: '100%', height: 1,
                      background: ox,
                      transform: `scaleX(${ruleT})`,
                      transformOrigin: '50% 50%',
                      marginBottom: 28,
                    }}/>

                    {/* Label */}
                    <div style={{
                      fontFamily: '"Work Sans", sans-serif',
                      fontSize: 12,
                      color: ash,
                      letterSpacing: '0.32em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      opacity: labelOp,
                      marginRight: '-0.32em',
                      marginBottom: 28,
                    }}>
                      {c.label}
                    </div>

                    {/* Big number */}
                    <div style={{
                      fontFamily: '"Libre Caslon Display", serif',
                      fontSize: 96,
                      color: ox,
                      lineHeight: 1,
                      letterSpacing: '-0.005em',
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: 28,
                    }}>
                      {c.display(animatedValue)}
                    </div>

                    {/* Delta */}
                    <div style={{
                      fontFamily: '"Work Sans", sans-serif',
                      fontSize: 13,
                      color: c.deltaColor,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      opacity: deltaOp,
                      marginRight: '-0.18em',
                    }}>
                      {c.delta}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom kicker — appears late */}
            <div style={{
              position: 'absolute',
              bottom: 64, left: 0, right: 0,
              textAlign: 'center',
              opacity: clamp((localTime - 6.0) / 0.6, 0, 1) * (1 - Easing.easeInCubic(outT)),
            }}>
              <div style={{
                fontFamily: '"Libre Baskerville", serif',
                fontStyle: 'italic',
                fontSize: 22,
                color: ink,
                opacity: 0.85,
              }}>
                Better than last month, on every front that matters.
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

window.SceneHeadline = SceneHeadline;
