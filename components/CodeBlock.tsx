import React, { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'sql' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Copy failed. Please manually select the text.');
    });
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleCopy}
        className={`absolute right-4 top-4 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl z-10 ${
          copied 
            ? 'bg-emerald-600 text-white scale-105' 
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 opacity-80 md:opacity-0 md:group-hover:opacity-100'
        }`}
      >
        {copied ? 'Copied' : 'Copy SQL'}
      </button>
      <pre className="bg-slate-950 text-slate-300 p-6 md:p-8 rounded-[2rem] overflow-x-auto text-xs md:text-sm leading-relaxed border border-slate-800 shadow-2xl max-h-[70vh] custom-scrollbar">
        <code className="block whitespace-pre font-mono">{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;