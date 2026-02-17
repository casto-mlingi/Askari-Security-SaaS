import React, { useState } from 'react';
import { uploadToAmini } from '../services/uploadService';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      try {
        const nameLower = (file.name || '').toLowerCase();
        const isImage = file.type.startsWith('image/') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png');
        if (imagesOnly && !isImage) {
          (window as any).showNotification?.('error', 'Tafadhali pakia picha ya pasipoti (Image) pekee.');
          e.target.value = '';
          return;
        }
        const url = await uploadToAmini(file);
        onUpload(url);
        (window as any).showNotification?.('success', 'Upload completed.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed. Try again.';
        (window as any).showNotification?.('error', msg);
      }
    }
    e.target.value = ''; // Allow re-uploading the same file
  };
  
  const hasError = error && !fileUrl;
  const isPdf = fileUrl?.startsWith('data:application/pdf');
  const isPdfUrl = !!fileUrl && fileUrl.toLowerCase().endsWith('.pdf');

  return (
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
      <input
        type="file"
        onChange={handleFileChange}
        className={`absolute inset-0 opacity-0 z-10 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        accept={acceptTypes ? acceptTypes : (imagesOnly ? 'image/*' : 'image/*,.pdf')}
        disabled={!!disabled}
      />
      
      {fileUrl ? (
        <div className="w-full h-full flex items-center p-3 md:p-0">
          {(isPdf || isPdfUrl) ? (
            <div className="w-16 h-16 md:w-full md:h-full flex items-center justify-center bg-slate-100 shrink-0 rounded-lg md:rounded-none">
              <div className="flex flex-col items-center justify-center text-red-500">
                <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                <span className="hidden md:block text-[9px] font-black uppercase tracking-wider mt-2">PDF Document</span>
              </div>
            </div>
          ) : (
            <img src={fileUrl} alt={label} className="w-16 h-16 md:absolute md:inset-0 md:w-full md:h-full object-cover rounded-lg md:rounded-none" />
          )}
          
          <div className="flex-grow pl-4 md:hidden">
            <p className="text-xs font-black text-slate-700 uppercase">{label}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">✓ Uploaded</p>
          </div>

          <div className={`md:absolute md:inset-0 md:bg-slate-900/60 flex items-center justify-center ${disabled ? 'md:opacity-0' : 'md:opacity-0 group-hover:opacity-100'} transition-opacity duration-300 z-20 gap-3`}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewOpen(true); }}
              className="w-10 h-10 flex items-center justify-center bg-white/80 text-slate-700 rounded-lg md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider shadow-sm md:shadow-none"
              disabled={!!disabled}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
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
            Uploaded
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center p-3 md:p-0 md:flex-col md:items-center md:justify-center md:gap-4 pointer-events-none">
          <div className={`w-16 h-16 md:w-12 md:h-12 shrink-0 rounded-lg md:rounded-xl flex items-center justify-center border-2 border-dashed md:border-solid group-hover:scale-110 transition-all ${hasError ? 'border-red-200 bg-white text-red-400' : 'border-slate-200 bg-white text-slate-300'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"/></svg>
          </div>
          <div className="text-left md:text-center pl-4 md:pl-0">
            <span className={`text-xs font-black uppercase tracking-widest ${hasError ? 'text-red-600' : 'text-slate-400'}`}>{label}</span>
            {hasError && <span className="block text-[9px] font-bold text-red-500 uppercase tracking-widest mt-1">Required</span>}
          </div>
        </div>
      )}
      {previewOpen && fileUrl && (
        <div className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden relative">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              ✕
            </button>
            <div className="bg-slate-50 border-b border-slate-100 p-4">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{label}</p>
            </div>
            <div className="max-h-[80vh] overflow-auto">
              {(isPdf || isPdfUrl) ? (
                <iframe src={fileUrl} className="w-full h-[80vh]" title="Document Preview" />
              ) : (
                <img src={fileUrl} alt={label} className="w-full h-auto object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
