import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, Crop, Move, Maximize } from 'lucide-react';
import { processDocumentImage } from '../utils/scannerUtils';

interface DocumentScannerProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const DocumentScanner: React.FC<DocumentScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'capture' | 'crop' | 'review'>('capture');
  
  // Rectangular crop area (percentage 0-100)
  const [crop, setCrop] = useState({ x: 10, y: 15, width: 80, height: 70 });
  const [dragging, setDragging] = useState<'top' | 'bottom' | 'left' | 'right' | 'move' | null>(null);

  useEffect(() => {
    if (mode === 'capture') startCamera();
    return () => stopCamera();
  }, [mode]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvas.toDataURL('image/jpeg'));
      setMode('crop');
      stopCamera();
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    
    setCrop(prev => {
      let { x: cx, y: cy, width: cw, height: ch } = prev;
      if (dragging === 'left') { cw += cx - x; cx = x; }
      if (dragging === 'right') { cw = x - cx; }
      if (dragging === 'top') { ch += cy - y; cy = y; }
      if (dragging === 'bottom') { ch = y - cy; }
      if (dragging === 'move') { cx = x - cw/2; cy = y - ch/2; }
      
      // Constraints
      cx = Math.max(0, Math.min(100 - cw, cx));
      cy = Math.max(0, Math.min(100 - ch, cy));
      cw = Math.max(10, Math.min(100 - cx, cw));
      ch = Math.max(10, Math.min(100 - cy, ch));
      
      return { x: cx, y: cy, width: cw, height: ch };
    });
  }, [dragging]);

  const handleProcess = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    try {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = capturedImage; });
      
      // Standard rectangular points for the crop
      const points = [
        { x: (crop.x / 100) * img.width, y: (crop.y / 100) * img.height },
        { x: ((crop.x + crop.width) / 100) * img.width, y: (crop.y / 100) * img.height },
        { x: ((crop.x + crop.width) / 100) * img.width, y: ((crop.y + crop.height) / 100) * img.height },
        { x: (crop.x / 100) * img.width, y: ((crop.y + crop.height) / 100) * img.height }
      ];

      const file = await processDocumentImage(capturedImage, {}, points);
      onCapture(file);
      onClose();
    } catch (err) {
      setError('Processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-8 select-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseUp={() => setDragging(null)}
      onTouchEnd={() => setDragging(null)}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between z-10">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all font-black">✕</button>
        <span className="text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">
          {mode === 'capture' ? 'Scanner Ready' : 'Align Document'}
        </span>
        <div className="w-10" />
      </div>

      {/* Main View Area */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-2xl h-full flex-grow flex items-center justify-center mt-4 mb-4 overflow-hidden rounded-[2.5rem] border-2 border-white/10 bg-slate-900 shadow-2xl"
      >
        {mode === 'capture' ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[80%] h-[70%] border-2 border-dashed border-emerald-400/40 rounded-2xl relative shadow-[0_0_100px_rgba(16,185,129,0.1)]">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scanner-line" />
              </div>
            </div>
          </>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <img src={capturedImage!} alt="Preview" className="max-w-full max-h-full object-contain opacity-50" />
            
            {/* Simple Crop Box */}
            <div 
              style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
              className="absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_30px_rgba(16,185,129,0.3)] group"
            >
              {/* Handles */}
              <div onMouseDown={() => setDragging('move')} onTouchStart={() => setDragging('move')} className="absolute inset-4 cursor-move" />
              <div onMouseDown={() => setDragging('left')} onTouchStart={() => setDragging('left')} className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize -ml-2" />
              <div onMouseDown={() => setDragging('right')} onTouchStart={() => setDragging('right')} className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize -mr-2" />
              <div onMouseDown={() => setDragging('top')} onTouchStart={() => setDragging('top')} className="absolute top-0 left-0 right-0 h-4 cursor-ns-resize -mt-2" />
              <div onMouseDown={() => setDragging('bottom')} onTouchStart={() => setDragging('bottom')} className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize -mb-2" />
              
              {/* Corner Visuals */}
              <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-400" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-400" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-400" />
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-center gap-8">
        {mode === 'capture' ? (
          <button onClick={captureFrame} className="w-20 h-20 rounded-full border-4 border-white/30 p-1 hover:border-white/50 transition-all">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center active:scale-90 transition-all shadow-xl">
              <Camera className="w-8 h-8 text-black" />
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-6">
            <button onClick={() => setMode('capture')} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700 group-hover:bg-slate-700 transition-all shadow-lg"><RefreshCw className="w-5 h-5" /></div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Retake</span>
            </button>
            <button 
              onClick={handleProcess} 
              disabled={isProcessing}
              className="px-10 h-16 rounded-full bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
            >
              {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {isProcessing ? 'Saving...' : 'Finish Scan'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanner-line { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-scanner-line { animation: scanner-line 2.5s ease-in-out infinite; }
      `}</style>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default DocumentScanner;
