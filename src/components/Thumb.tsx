import { useObjectUrl } from '../hooks/useData'

export function Thumb({ blob, alt, className = '' }: { blob: Blob; alt: string; className?: string }) {
  const url = useObjectUrl(blob)
  return url ? (
    <img src={url} alt={alt} loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div className={`animate-pulse bg-slate-200 ${className}`} />
  )
}
