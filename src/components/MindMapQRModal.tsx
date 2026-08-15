import React, { useEffect, useState } from 'react';
import { QrCode, X, Copy, Download, Check, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';

interface MindMapQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  sessionTitle?: string;
}

export const MindMapQRModal: React.FC<MindMapQRModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  sessionTitle = "MindSphere Map Session"
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const cleanCode = sessionCode ? sessionCode.trim().toUpperCase().replace(/^(MIND|LIVE)-/, '') : '';

  useEffect(() => {
    if (!isOpen || !cleanCode) return;
    setQrDataUrl('');
    fetch(`/api/config/share-url?code=${encodeURIComponent(cleanCode)}`)
      .then(response => {
        if (!response.ok) throw new Error('Unable to resolve network share URL.');
        return response.json();
      })
      .then(data => setShareUrl(data.joinUrl))
      .catch(error => {
        console.error('Failed to resolve network share URL:', error);
        const cloudPath = ['ezmindsphere.ejoetso.com', 'ezmindsphere.netlify.app'].includes(window.location.hostname) ? '/app' : '';
        setShareUrl(`${window.location.origin}${cloudPath}?code=${encodeURIComponent(cleanCode)}`);
      });
  }, [isOpen, cleanCode]);

  useEffect(() => {
    if (cleanCode && shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        setQrDataUrl(url);
      }).catch(err => {
        console.error('Failed to generate QR code data URL:', err);
      });
    }
  }, [cleanCode, shareUrl]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `MindSphere_QR_${cleanCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shadow-inner mt-2">
          <QrCode className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white tracking-wide">{sessionTitle}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Scan QR code or use code to access Mindmap</p>
        </div>

        {/* 4-Digit Code Card */}
        <div className="bg-slate-950 border border-indigo-900/40 rounded-xl px-5 py-2.5 w-full flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-500">4-Digit Session Code</span>
            <div className="text-2xl font-black font-mono text-indigo-400 tracking-widest">{cleanCode}</div>
          </div>
          <button
            onClick={handleCopyCode}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 transition flex items-center gap-1 text-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* QR Image */}
        <div className="bg-white p-3 rounded-2xl border border-slate-800 shadow-lg relative group">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Session QR Code" className="w-44 h-44 rounded-lg object-contain" />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">Generating QR...</div>
          )}
        </div>

        <div className="w-full space-y-2 pt-1">
          <p className="text-[10px] font-mono text-slate-400 break-all">{shareUrl || 'Resolving network address…'}</p>
          <button
            onClick={handleDownloadQR}
            disabled={!qrDataUrl}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Save / Download QR Code</span>
          </button>

          <button
            onClick={handleCopyLink}
            disabled={!shareUrl}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs py-2 px-4 rounded-xl border border-slate-700 transition"
          >
            {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-4 h-4 text-indigo-400" />}
            <span>{copiedUrl ? 'Direct Link Copied!' : 'Copy Direct Access URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
