import React, { useState } from 'react';

interface ImportRow {
  name: string;
  phone: string;
  nida: string;
  gender: string;
}

const BulkImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finished, setFinished] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview([
        { name: 'Abubakar Salim', phone: '0712-334-556', nida: '19890101-12345-00001-10', gender: 'M' },
        { name: 'Fatuma Juma', phone: '0655-998-112', nida: '19921212-54321-00002-22', gender: 'F' },
        { name: 'Bakari Ali', phone: '0777-111-222', nida: '19850606-98765-00003-33', gender: 'M' },
      ]);
    }
  };

  const processImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
        setIsProcessing(false);
        setFinished(true);
    }, 2000);
  };

  return (
    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 p-5 md:p-10 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900">Bulk Upload</h2>
                <p className="text-slate-500 text-xs font-medium">Upload a list of new applicants from a file.</p>
            </div>
            <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all">
                Download Template File
            </button>
        </div>

        {!file ? (
            <label className="border-4 border-dashed border-slate-100 rounded-[2rem] p-10 md:p-20 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group active:scale-[0.98]">
                <input type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.csv" />
                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span className="text-sm md:text-lg font-black uppercase tracking-tight text-slate-800">Upload Applicant File</span>
                <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">XLSX / CSV FORMAT</span>
            </label>
        ) : !finished ? (
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg">DATA</div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">{file.name}</p>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">3 VALID ROWS FOUND</p>
                        </div>
                    </div>
                    <button onClick={() => setFile(null)} className="p-2 text-slate-300 hover:text-red-500 active:scale-90 transition-all">✕</button>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px] md:text-xs font-bold uppercase tracking-tight">
                            <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 whitespace-nowrap">
                                <tr>
                                    <th className="px-6 py-4 font-black">Name</th>
                                    <th className="px-6 py-4 font-black">NIDA Number</th>
                                    <th className="px-6 py-4 font-black">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {preview.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-900">{row.name}</td>
                                        <td className="px-6 py-4 font-mono text-slate-500">{row.nida.slice(0, 15)}...</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase border border-emerald-100">READY</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <button 
                    onClick={processImport}
                    disabled={isProcessing}
                    className="w-full py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-600 active:scale-95 transition-all shadow-xl shadow-slate-200"
                >
                    {isProcessing ? 'UPLOADING...' : 'Upload and Save'}
                </button>
            </div>
        ) : (
            <div className="text-center py-12 md:py-20 animate-in zoom-in-95 duration-500">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-50">
                    <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900">Upload Complete</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-2 text-xs md:text-sm font-medium">The new applicants have been successfully added to the system.</p>
                <button onClick={() => {setFile(null); setFinished(false);}} className="mt-8 px-10 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-lg">Finish</button>
            </div>
        )}
    </div>
  );
};

export default BulkImport;
