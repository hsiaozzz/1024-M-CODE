import Image from 'next/image';

export function McDonaldsIcon({ className = 'brand-mark' }: { className?: string }) {
  return (
    <Image
      src="/mcdonalds.svg"
      alt="麦当劳"
      width={40}
      height={40}
      className={className}
      unoptimized
    />
  );
}
