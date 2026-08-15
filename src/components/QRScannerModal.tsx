import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QrCode, Camera, Upload, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
  title?: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan QR Code to Access Session & Mindmap"
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const extractCode = (data: string): string => {
    let clean = data.trim();
    try {
      if (clean.includes('http://') || clean.includes('https://') || clean.includes('?code=')) {
        const urlObj = new URL(clean);
        const codeParam = urlObj.searchParams.get('code') || urlObj.searchParams.get('joinCode');
        if (codeParam) return codeParam;
      }
    } catch (e) {
      // Not a valid URL string, use raw data
    }
    return clean;
  };

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        const parsedCode = extractCode(code.data);
        setManualSuccess(parsedCode);
        onScanSuccess(parsedCode);
        onClose();
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [onScanSuccess, onClose]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Unable to access video camera. Please allow camera permissions or upload a QR image.');
      setIsScanning(false);
    }
  }, [processFrame]);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const parsedCode = extractCode(code.data);
          setManualSuccess(parsedCode);
          onScanSuccess(parsedCode);
          onClose();
        } else {
          setCameraError('No valid QR code found in uploaded image. Please try another image.');
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col gap-4 relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Scanner / Error View */}
        <div className="relative w-full aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraError ? 'hidden' : 'block'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Target Reticle Overlay */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 border-2 border-indigo-500/40 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-indigo-400 rounded-2xl relative animate-pulse">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 -mb-1 -mr-1"></div>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-4 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 text-xs font-bold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 rounded-xl border border-indigo-800/40 transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
              </button>
            </div>
          )}
        </div>

        {manualSuccess && (
          <div className="bg-emerald-950/60 border border-emerald-800/60 p-2.5 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Found Session Code: <strong>{manualSuccess}</strong></span>
          </div>
        )}

        {/* Fallback Image Upload */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <label className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-3 rounded-xl cursor-pointer transition">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Upload QR Image File</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
