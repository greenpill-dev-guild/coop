import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { DevEnvironmentState } from '../dev-environment';

export function DevTunnelBadge({ environment }: { environment: DevEnvironmentState | null }) {
  const publicUrl = environment?.app.publicUrl;
  const qrUrl = environment?.app.qrUrl;
  const accessToken = environment?.accessToken;
  const signalUrl = environment?.api.websocketUrl;
  const docsUrl = environment?.docs.localUrl;
  const [qrImageSrc, setQrImageSrc] = useState('');

  useEffect(() => {
    if (!qrUrl) {
      setQrImageSrc('');
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 132,
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrImageSrc(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrImageSrc('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  if (!environment || (!publicUrl && !environment.tunnel.reason)) {
    return null;
  }

  return (
    <aside className="dev-tunnel-card" aria-label="Coop dev tunnel">
      <p className="dev-tunnel-card__eyebrow">Dev Tunnel</p>
      {publicUrl ? (
        <>
          <p className="dev-tunnel-card__title">Scan to open the PWA on your phone.</p>
          <div className="dev-tunnel-card__body">
            <div className="dev-tunnel-card__qr" aria-hidden="true">
              {qrImageSrc ? <img alt="" src={qrImageSrc} /> : <span>QR</span>}
            </div>
            <div className="dev-tunnel-card__details">
              <p className="dev-tunnel-card__code-label">Passcode</p>
              <p className="dev-tunnel-card__code">{accessToken ?? 'pending'}</p>
              <p className="dev-tunnel-card__meta">
                App
                <span>{publicUrl}</span>
              </p>
              {signalUrl ? (
                <p className="dev-tunnel-card__meta">
                  Signal
                  <span>{signalUrl}</span>
                </p>
              ) : null}
              {docsUrl ? (
                <p className="dev-tunnel-card__meta">
                  Docs
                  <span>{docsUrl}</span>
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="dev-tunnel-card__fallback">{environment.tunnel.reason}</p>
      )}
    </aside>
  );
}
