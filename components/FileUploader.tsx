import React, { useState } from 'react';
import { uploadToAmini } from '../services/uploadService';
import { Camera, LucideIcon } from 'lucide-react';
import DocumentScanner from './DocumentScanner';

interface FileUploaderProps {
  label: string;
  fileUrl?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  imagesOnly?: boolean;
  acceptTypes?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ label, fileUrl, onUpload, onRemove, className = 'md:h-36', error, disabled, imagesOnly, acceptTypes }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      await processAndUpload(file);
    }
    e.target.value = ''; // Allow re-uploading the same file
  };

  const processAndUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const nameLower = (file.name || '').toLowerCase();
      const isImage = file.type.startsWith('image/') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png');
      
      if (imagesOnly && !isImage) {
        (window as any).showNotification?.('error', 'Tafadhali pakia picha ya pasipoti (Image) pekee.');
        return;
      }
      
      const url = await uploadToAmini(file);
      onUpload(url);
      (window as any).showNotification?.('success', 'Upload completed.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Try again.';
      (window as any).showNotification?.('error', msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleScanCapture = async (file: File) => {
    await processAndUpload(file);
  };
  
  const hasError = error && !fileUrl;

  return (
    <>
      <div className={`relative transition-all duration-300 group
        h-24 ${className}
        md:flex md:flex-col md:items-center md:justify-center overflow-hidden
        border-2 md:border-4 md:border-dashed 
        rounded-2xl md:rounded-[2.5rem]
        ${
          fileUrl 
          ? 'border-slate-200 bg-slate-50 md:bg-slate-200 md:border-slate-300' 
          : hasError 
          ? 'border-red-300 bg-red-50 md:border-red-500' 
          : 'border-slate-200 bg-slate-50 md:border-slate-100 md:hover:border-primary'
        }
      `}>
        {/* Only show input if NOT scanning and NOT uploading */}
        {!disabled && !fileUrl && !isUploading && (
          <input
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 z-10 cursor-pointer"
            accept={acceptTypes ? acceptTypes : (imagesOnly ? 'image/*' : 'image/*,.pdf')}
          />
        )}
        
        {fileUrl ? (
          <div className="w-full h-full flex items-center p-3 md:p-0">
            <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center bg-slate-100 shrink-0 rounded-lg md:rounded-xl overflow-hidden">
               <img src={fileUrl.startsWith('http') ? fileUrl : `https://api.amini.co.tz/uploads/${fileUrl}`} alt="" className="w-full h-full object-cover opacity-50" />
            </div>
            
            <div className="flex-grow pl-4 md:hidden">
              <p className="text-xs font-black text-slate-700 uppercase">{label}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">✓ Reference Saved</p>
            </div>

            <div className={`md:absolute md:inset-0 md:bg-slate-900/60 flex items-center justify-center ${disabled ? 'md:bg-transparent md:opacity-0' : 'md:opacity-0 group-hover:opacity-100'} transition-opacity duration-300 z-20 gap-3`}>
              <button
                  type="button"
                  onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!disabled) onRemove();
                  }}
                  className={`w-10 h-10 md:w-auto md:h-auto shrink-0 flex items-center justify-center ${disabled ? 'bg-white/50 text-slate-400 cursor-not-allowed' : 'bg-white/80 text-slate-500 md:bg-red-600 md:text-white'} rounded-lg md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider shadow-sm md:shadow-none`}
                  disabled={!!disabled}
              >
                  <span className="md:hidden">✕</span>
                  <span className="hidden md:inline">Remove</span>
              </button>
            </div>

            <div className="hidden md:flex absolute bottom-2 right-2 bg-emerald-500 text-white px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider items-center gap-1 z-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" /></svg>
              Reference Saved
            </div>
          </div>
        ) : isUploading ? (
          <div className="w-full h-full flex items-center justify-center gap-3">
             <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
             <span className="text-[10px] font-black text-primary uppercase tracking-widest">Uploading...</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center p-3 md:p-0 md:flex-col md:items-center md:justify-center md:gap-2">
            <div className={`w-16 h-16 md:w-10 md:h-10 shrink-0 rounded-lg md:rounded-xl flex items-center justify-center border-2 border-dashed md:border-solid transition-all bg-white ${hasError ? 'border-red-200 text-red-400' : 'border-slate-200 text-slate-300'}`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"/></svg>
            </div>
            <div className="text-left md:text-center pl-4 md:pl-0">
              <span className={`text-xs font-black uppercase tracking-widest ${hasError ? 'text-red-600' : 'text-slate-400'}`}>{label}</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="hidden md:inline text-[9px] font-bold text-slate-300 uppercase tracking-widest">Drop or Click</span>
                <button
                  type="button"
                  disabled={!!disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowScanner(true);
                  }}
                  className="z-20 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-all border border-primary/20"
                >
                  <Camera className="w-3 h-3" />
                  Scan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showScanner && (
        <DocumentScanner 
          onCapture={handleScanCapture}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
};

export default FileUploader;
