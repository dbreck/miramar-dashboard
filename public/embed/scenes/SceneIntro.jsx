// Scene 1 — Intro / titlecard
// Establishes brand, period, and what we're about to see.

function SceneIntro({ start = 0, end = 5 }) {
  const ox = '#4B0108';
  const cream = '#F3ECE7';
  const rose = '#A4515E';
  const burg = '#401516';

  return (
    <Sprite start={start} end={end}>
      {({ localTime, progress }) => {
        // Background drift — a deep oxblood fading from black
        const bgOpacity = Easing.easeOutCubic(clamp(localTime / 0.8, 0, 1));

        // Monogram line (eyebrow) — appears first
        const eyeOp = clamp((localTime - 0.2) / 0.6, 0, 1);
        const eyeY = (1 - Easing.easeOutCubic(eyeOp)) * 12;

        // Wordmark — fade up
        const brandOp = clamp((localTime - 0.7) / 0.7, 0, 1);
        const brandY = (1 - Easing.easeOutCubic(brandOp)) * 18;

        // Hairline rule — scales from center
        const ruleScale = Easing.easeOutCubic(clamp((localTime - 1.4) / 0.7, 0, 1));

        // Title — script flourish, fades in
        const titleOp = clamp((localTime - 1.8) / 0.8, 0, 1);
        const titleY = (1 - Easing.easeOutCubic(titleOp)) * 24;

        // Period subtitle
        const periodOp = clamp((localTime - 2.6) / 0.6, 0, 1);

        // Compare chip
        const chipOp = clamp((localTime - 3.2) / 0.5, 0, 1);

        // Subtle camera push-in on the whole composition (Ken Burns)
        const camScale = 1 + 0.04 * Easing.easeOutCubic(clamp(localTime / (end - start), 0, 1));

        // Exit
        const exitT = clamp((localTime - (end - start - 0.6)) / 0.6, 0, 1);
        const exitOp = 1 - Easing.easeInCubic(exitT);

        return (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${burg} 0%, ${ox} 60%, #2a0508 100%)`,
            opacity: bgOpacity * exitOp,
            overflow: 'hidden',
          }}>
            {/* Soft warm vignette top */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 50% 30%, rgba(164,81,94,0.35), transparent 55%)',
              pointerEvents: 'none',
            }}/>
            {/* Film grain via noise */}
            <FilmGrain opacity={0.06}/>

            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              transform: `scale(${camScale})`,
              transformOrigin: '50% 50%',
              textAlign: 'center',
            }}>
              {/* Eyebrow */}
              <div style={{
                fontFamily: '"Libre Caslon Display", serif',
                fontSize: 18,
                color: rose,
                letterSpacing: '0.5em',
                textTransform: 'uppercase',
                opacity: eyeOp,
                transform: `translateY(${eyeY}px)`,
                marginBottom: 28,
                marginRight: '-0.5em',
                whiteSpace: 'nowrap',
              }}>
                Established 1922 · Reborn
              </div>

              {/* Wordmark */}
              <div style={{
                fontFamily: '"Libre Caslon Display", serif',
                fontSize: 84,
                color: cream,
                letterSpacing: '0.22em',
                fontWeight: 400,
                opacity: brandOp,
                transform: `translateY(${brandY}px)`,
                marginRight: '-0.22em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>
                MIRA MAR
              </div>

              {/* Hairline rule */}
              <div style={{
                width: 120, height: 1,
                background: rose,
                margin: '36px 0',
                transform: `scaleX(${ruleScale})`,
                transformOrigin: '50% 50%',
                opacity: 0.85,
              }}/>

              {/* Title */}
              <div style={{
                fontFamily: '"Pinyon Script", "Snell Roundhand", cursive',
                fontSize: 110,
                color: cream,
                fontWeight: 500,
                lineHeight: 1,
                opacity: titleOp,
                transform: `translateY(${titleY}px)`,
                fontStyle: 'normal',
                whiteSpace: 'nowrap',
              }}>
                Marketing Performance
              </div>
              <div style={{
                fontFamily: '"Libre Caslon Display", serif',
                fontSize: 22,
                color: cream,
                letterSpacing: '0.34em',
                textTransform: 'uppercase',
                marginTop: 10,
                opacity: titleOp,
                transform: `translateY(${titleY}px)`,
                marginRight: '-0.34em',
              }}>
                Report
              </div>

              {/* Period */}
              <div style={{
                marginTop: 56,
                fontFamily: '"Work Sans", sans-serif',
                fontSize: 16,
                color: cream,
                opacity: 0.78 * periodOp,
                letterSpacing: '0.34em',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}>
                March 27 — April 25, 2026
              </div>

              {/* Compare chip */}
              <div style={{
                marginTop: 18,
                opacity: chipOp,
                fontFamily: '"Work Sans", sans-serif',
                fontSize: 11,
                color: rose,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                border: `1px solid ${rose}`,
                padding: '8px 18px',
                borderRadius: 999,
              }}>
                ▲  vs  Feb 11 — Mar 11, 2026
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

// Reusable film grain overlay
function FilmGrain({ opacity = 0.05 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none',
      opacity,
      mixBlendMode: 'overlay',
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
    }}/>
  );
}

window.SceneIntro = SceneIntro;
window.FilmGrain = FilmGrain;
