import React, { useState } from 'react';
import { getImageUrl } from '../utils/images';

interface Props {
  filename?: string | null;
  alt?: string;
  className?: string;
  fallbackLetter?: string;
}

const AvatarImage: React.FC<Props> = ({ filename, alt, className, fallbackLetter }) => {
  const [broken, setBroken] = useState(false);

  if (!filename || broken) {
    // Professional SVG Placeholder
    return (
      <div className={`${className || 'w-10 h-10'} bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-[60%] h-[60%] opacity-50">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </div>
    );
  }

  const src = getImageUrl(filename);
  return (
    <img
      src={src}
      alt={alt || 'Avatar'}
      className={className}
      onError={() => setBroken(true)}
    />
  );
};

export default AvatarImage;

