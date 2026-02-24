import React, { useState } from 'react';
import { getImageUrl } from '../utils/images';

interface Props {
  filename?: string;
  alt?: string;
  className?: string;
  fallbackLetter?: string;
}

const AvatarImage: React.FC<Props> = ({ filename, alt, className, fallbackLetter }) => {
  const [broken, setBroken] = useState(false);
  if (!filename || broken) {
    return (
      <div className={`${className || ''} bg-amber-50 text-amber-600 flex items-center justify-center font-black`}>
        <span>{fallbackLetter || 'G'}</span>
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

