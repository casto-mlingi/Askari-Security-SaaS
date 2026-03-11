import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Download, FileText, Image as ImageIcon, Maximize2, Minimize2 } from 'lucide-react';

interface DocumentViewerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
}

const DocumentViewerDialog: React.FC<DocumentViewerDialogProps> = ({ isOpen, onClose, url: rawUrl, title }) => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const url = rawUrl && !rawUrl.startsWith('http')
        ? `https://api.amini.co.tz/uploads/${rawUrl}`
        : rawUrl;

    const isPDF = url?.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-3xl animate-in fade-in duration-700">
            <div
                className={`relative w-full transition-all duration-500 ease-out flex flex-col overflow-hidden bg-white/90 backdrop-blur-2xl border border-white/40 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.5)] animate-in zoom-in-95 slide-in-from-bottom-10 
                ${isMaximized ? 'h-full rounded-2xl' : 'max-w-6xl h-[85vh] rounded-[2.5rem]'}`}
            >
                {/* Floating Premium Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200/50 bg-white/50">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                                {isPDF ? <FileText className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">Secure Asset</span>
                                <p className="text-[9px] font-medium text-slate-400 truncate max-w-[200px] italic">#{rawUrl?.split('_')[0] || 'DOC'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Control Actions */}
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50">
                            <button
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl transition-all duration-300 active:scale-90"
                                title={isMaximized ? "Restore" : "Maximize"}
                            >
                                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                            <div className="w-px h-4 bg-slate-300/50 mx-1"></div>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-all duration-300 active:scale-90"
                                title="Open Original Source"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>

                        <button
                            onClick={onClose}
                            className="group p-3 bg-slate-900 hover:bg-red-600 text-white rounded-2xl transition-all duration-500 shadow-xl shadow-slate-900/10 hover:shadow-red-600/20 active:scale-90"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                        </button>
                    </div>
                </div>

                {/* Immersive Viewport */}
                <div className="flex-1 bg-[#F8FAFC] relative overflow-hidden flex items-center justify-center group/view">
                    {/* Subtle Grid Pattern Overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px]"></div>

                    {url ? (
                        isPDF ? (
                            <div className="w-full h-full p-4 md:p-8 animate-in fade-in zoom-in-105 duration-700">
                                <iframe
                                    src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
                                    className="w-full h-full rounded-2xl shadow-2xl bg-white border border-slate-200/50"
                                    title={title}
                                />
                            </div>
                        ) : isImage ? (
                            <div className="relative p-8 md:p-12 animate-in fade-in zoom-in-95 duration-700">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 blur-3xl opacity-50"></div>
                                <img
                                    src={url}
                                    alt={title}
                                    className="relative max-w-full max-h-[70vh] object-contain rounded-2xl shadow-[0_48px_100px_-12px_rgba(0,0,0,0.3)] border-[12px] border-white ring-1 ring-slate-200/50"
                                />
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 translate-y-8 opacity-0 group-hover/view:translate-y-0 group-hover/view:opacity-100 transition-all duration-500">
                                    <div className="px-6 py-3 bg-slate-900/90 backdrop-blur-xl text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3">
                                        <ImageIcon className="w-3 h-3 text-indigo-400" />
                                        High Resolution Preview
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-md w-full mx-auto p-12 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center animate-in slide-in-from-top-4 duration-700">
                                <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 relative">
                                    <FileText className="w-12 h-12 text-slate-300" />
                                    <div className="absolute -bottom-2 -right-2 p-2 bg-red-500 rounded-xl text-white shadow-lg">
                                        <X className="w-4 h-4" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-3">Native Preview unavailable</h3>
                                <p className="text-sm font-bold text-slate-500 mb-10 leading-relaxed px-4">This file format requires a dedicated application. Would you like to save it to your device?</p>
                                <a
                                    href={url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative inline-flex items-center justify-center gap-3 px-10 h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] transform transition-all duration-300 hover:scale-105 active:scale-95 text-xs shadow-2xl shadow-slate-900/20"
                                >
                                    <Download className="w-5 h-5 text-indigo-400 group-hover:animate-bounce" />
                                    Download Secure Copy
                                </a>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center gap-6 opacity-20">
                            <div className="w-24 h-24 border-4 border-dashed border-slate-400 rounded-[2.5rem] animate-spin-slow"></div>
                            <span className="text-sm font-black uppercase tracking-widest text-slate-500">Awaiting Data Stream</span>
                        </div>
                    )}
                </div>

                {/* Premium Footer */}
                <div className="px-8 py-4 bg-slate-50/80 border-t border-slate-200/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Encrypted Session — Amini Platform</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentViewerDialog;
