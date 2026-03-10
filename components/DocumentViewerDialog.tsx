import React from 'react';
import { X, ExternalLink, Download, FileText, Image as ImageIcon } from 'lucide-react';

interface DocumentViewerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
}

const DocumentViewerDialog: React.FC<DocumentViewerDialogProps> = ({ isOpen, onClose, url: rawUrl, title }) => {
    if (!isOpen) return null;

    // Database contains ONLY filenames. Redundantly ensure the prefix is hardcoded.
    const url = rawUrl && !rawUrl.startsWith('http')
        ? `https://api.amini.co.tz/uploads/${rawUrl}`
        : rawUrl;

    const isPDF = url?.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            {isPDF ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-xs">{url}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-primary transition-colors"
                            title="Open in new tab"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-slate-100 relative overflow-auto p-4 flex items-center justify-center">
                    {url ? (
                        isPDF ? (
                            <iframe
                                src={`${url}#toolbar=0`}
                                className="w-full h-full rounded-lg shadow-inner bg-white"
                                title={title}
                            />
                        ) : isImage ? (
                            <img
                                src={url}
                                alt={title}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg border-4 border-white"
                            />
                        ) : (
                            <div className="text-center p-12 bg-white rounded-2xl shadow-xl border-2 border-dashed border-slate-200">
                                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <p className="text-lg font-black text-slate-900 uppercase tracking-widest mb-2">Unsupported Preview</p>
                                <p className="text-sm font-bold text-slate-500 mb-6">This file type cannot be previewed directly.</p>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 h-12 bg-primary text-white rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-all text-xs"
                                >
                                    <Download className="w-4 h-4" /> Download Instead
                                </a>
                            </div>
                        )
                    ) : (
                        <div className="text-center text-slate-400 font-bold uppercase tracking-widest">
                            No Document URL Provided
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Forensic Document Viewer — ASKARI SEC</p>
                </div>
            </div>
        </div>
    );
};

export default DocumentViewerDialog;
