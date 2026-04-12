import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Under Maintenance | Grand Arena Tools',
  description: 'Grand Arena Tools is currently under maintenance. We\'ll be back shortly.',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .maintenance-root {
          min-height: 100vh;
          background: #060811;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
          position: relative;
          padding: 24px;
        }

        /* Fondo animado */
        .bg-glow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(168,85,247,0.12) 0%, transparent 60%);
          pointer-events: none;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }

        /* Card */
        .card {
          position: relative;
          z-index: 10;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 56px 48px 48px;
          max-width: 520px;
          width: 100%;
          text-align: center;
          backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(99,102,241,0.1),
            0 24px 64px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: fadeUp 0.6s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Icono */
        .icon-wrap {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2));
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
          50%       { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
        }

        .icon-wrap svg {
          width: 36px;
          height: 36px;
          color: #818cf8;
        }

        /* Badge */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 100px;
          padding: 4px 14px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #a5b4fc;
          margin-bottom: 20px;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          background: #f59e0b;
          border-radius: 50%;
          animation: blink 1.4s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }

        /* Texto */
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1.2;
          margin-bottom: 14px;
          letter-spacing: -0.5px;
        }

        .title span {
          background: linear-gradient(90deg, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          font-size: 15px;
          color: #64748b;
          line-height: 1.65;
          margin-bottom: 36px;
          max-width: 360px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Divider */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
          margin-bottom: 28px;
        }

        /* Footer info */
        .footer-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
        }

        .footer-info svg {
          width: 14px;
          height: 14px;
          color: #6366f1;
          flex-shrink: 0;
        }

        /* Partículas decorativas */
        .particle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.4;
          animation: float linear infinite;
        }

        .p1 { width:4px; height:4px; background:#6366f1; top:15%; left:10%; animation-duration:8s; animation-delay:-2s; }
        .p2 { width:3px; height:3px; background:#a855f7; top:70%; left:85%; animation-duration:10s; animation-delay:-5s; }
        .p3 { width:5px; height:5px; background:#818cf8; top:45%; left:92%; animation-duration:12s; animation-delay:-1s; }
        .p4 { width:3px; height:3px; background:#c084fc; top:80%; left:8%; animation-duration:9s; animation-delay:-7s; }
        .p5 { width:4px; height:4px; background:#6366f1; top:25%; left:88%; animation-duration:11s; animation-delay:-3s; }

        @keyframes float {
          0%   { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
          50%  { opacity: 0.7; }
          100% { transform: translateY(-60px) rotate(360deg); opacity: 0; }
        }
      `}</style>

      <div className="maintenance-root">
        <div className="bg-glow" />
        <div className="grid-overlay" />

        {/* Partículas */}
        <div className="particle p1" />
        <div className="particle p2" />
        <div className="particle p3" />
        <div className="particle p4" />
        <div className="particle p5" />

        <div className="card">
          {/* Icono */}
          <div className="icon-wrap">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.65-2.08L17.25 3 21 6.75l-3.93 3.93m-2.08 5.65-2.08-5.65" />
            </svg>
          </div>

          {/* Badge */}
          <div className="badge">
            <div className="badge-dot" />
            Under Maintenance
          </div>

          {/* Título */}
          <h1 className="title">
            We&apos;re <span>tuning things up</span>
          </h1>

          {/* Subtítulo */}
          <p className="subtitle">
            Grand Arena Tools is currently undergoing scheduled maintenance.
            We&apos;ll be back shortly with improvements and fixes.
          </p>

          <div className="divider" />

          {/* Footer */}
          <div className="footer-info">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Expected downtime: a few hours
          </div>
        </div>
      </div>
    </>
  );
}
