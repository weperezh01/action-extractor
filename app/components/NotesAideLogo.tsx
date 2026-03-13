import Image from 'next/image'

type NotesAideLogoProps = {
  className?: string
  title?: string
  variant?: 'full' | 'mark'
  withTagline?: boolean
  priority?: boolean
}

export function NotesAideLogo({
  className,
  title = 'Notes Aide',
  variant = 'full',
  withTagline = false,
  priority = false,
}: NotesAideLogoProps) {
  if (variant === 'mark') {
    return (
      <div className={`relative overflow-hidden ${className ?? ''}`} aria-label={title} role="img">
        <Image
          src="/notes-aide-logo-small.png"
          alt={title}
          fill
          sizes="32px"
          className="object-contain object-center scale-[1.14]"
          priority={priority}
        />
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`} aria-label={title} role="img">
      <div className="relative h-full aspect-square overflow-hidden rounded-xl">
        <Image
          src="/notes-aide-logo-small.png"
          alt={title}
          fill
          sizes="48px"
          className="object-contain object-center scale-[1.08]"
          priority={priority}
        />
      </div>

      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-black tracking-tight md:text-[15px]">{title}</p>
        {withTagline ? (
          <p className="truncate text-[11px] font-medium opacity-60">Transformando voz en acción</p>
        ) : null}
      </div>
    </div>
  )
}
