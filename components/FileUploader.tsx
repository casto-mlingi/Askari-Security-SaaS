import React from 'react';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

interface FileUploaderProps {
  label: string;
  fileUrl?: string;
  onUpload: (base64: string) => void;
  onRemove: () => void;
  className?: string;
  error?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ label, fileUrl, onUpload, onRemove, className = 'md:h-36', error }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      onUpload(base64);
    }
    e.target.value = ''; // Allow re-uploading the same file
  };
  
  const hasError = error && !fileUrl;
  const isPdf = fileUrl?.startsWith('data:application/pdf');

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
      <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 z-10 cursor-pointer" accept="image/*,.pdf" />
      
      {fileUrl ? (
        <div className="w-full h-full flex items-center p-3 md:p-0">
          {isPdf ? (
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

          <div className="md:absolute md:inset-0 md:bg-slate-900/60 flex items-center justify-center md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove();
                }}
                className="w-10 h-10 md:w-auto md:h-auto shrink-0 flex items-center justify-center bg-white/80 text-slate-500 md:bg-red-600 md:text-white rounded-lg md:px-4 md:py-2 text-xs font-bold uppercase tracking-wider shadow-sm md:shadow-none"
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
    </div>
  );
};

export default FileUploader;