export const TableRail = ({ isMobile }: { isMobile?: boolean }) => {
  const r = isMobile ? '40px' : '140px';
  const r1 = isMobile ? '38px' : '138px';
  const r2 = isMobile ? '35px' : '134px';

  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        borderRadius: r,
        background:
          'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 15%, #3a3a3a 30%, #1a1a1a 50%, #0d0d0d 70%, #2a2a2a 85%, #111 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.04), inset 0 12px 36px rgba(0,0,0,0.8), 0 20px 60px rgba(0,0,0,0.9), 0 0 100px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTopColor: 'rgba(255,255,255,0.15)',
        transition: 'border-radius 0.4s ease',
      }}
    >
      <div
        className="absolute inset-[2px]"
        style={{
          borderRadius: r1,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 30%, rgba(0,0,0,0.4) 100%)',
          transition: 'border-radius 0.4s ease',
        }}
      />
      <div
        className="absolute inset-[6px]"
        style={{
          borderRadius: r2,
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.9), inset 0 0 3px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.03)',
          transition: 'border-radius 0.4s ease',
        }}
      />
    </div>
  );
};

export const TableFelt = ({ isMobile, ...props }: { isMobile?: boolean }) => {
  const r = isMobile ? '28px' : '100px';

  /* Mobile: radial gradient kept but softened — doesn't go to near-black.
     Desktop: full depth radial. */
  const gradient = isMobile
    ? 'radial-gradient(ellipse at 50% 40%, #1a6b42 0%, #0f4d2e 35%, #0a3620 70%, #082e1a 100%)'
    : 'radial-gradient(ellipse at 50% 40%, #1a6b42 0%, #0f4d2e 30%, #0a3620 60%, #052416 100%)';

  const shadow = isMobile
    ? 'inset 0 1px 15px rgba(0,0,0,0.4), inset 0 0 40px rgba(0,0,0,0.2)'
    : 'inset 0 2px 30px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.3)';

  const spotlight = isMobile
    ? 'radial-gradient(ellipse at 50% 45%, rgba(78,222,163,0.05) 0%, transparent 50%)'
    : 'radial-gradient(ellipse at 50% 45%, rgba(78,222,163,0.06) 0%, transparent 55%)';

  const innerShadow = isMobile
    ? 'inset 0 0 20px rgba(0,0,0,0.45)'
    : 'inset 0 0 30px rgba(0,0,0,0.6), inset 0 0 8px rgba(0,0,0,0.4)';

  return (
    <div
      className="absolute inset-0 z-[1]" data-club-felt
      style={{
        borderRadius: r,
        background: gradient,
        boxShadow: shadow,
        border: '2px solid rgba(0,0,0,0.6)',
        transition: 'border-radius 0.4s ease',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          borderRadius: r,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          transition: 'border-radius 0.4s ease',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: r,
          background: spotlight,
          transition: 'border-radius 0.4s ease',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: r,
          boxShadow: innerShadow,
          transition: 'border-radius 0.4s ease',
        }}
      />
    </div>
  );
};
