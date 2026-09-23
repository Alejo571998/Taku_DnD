import { cn } from './cn';

/**
 * Marca TAKU.
 *
 * El dragón es SVG propio, no una fuente de iconos: es la marca y tiene que
 * verse nítida a 24px en la barra y a 64px en la portada, y funcionar sin
 * conexión sin descargar nada.
 */
export function DragonMark({
  className,
  title,
  silhouette = false,
}: {
  className?: string;
  title?: string;
  /**
   * Silueta plana para uso decorativo de fondo. Con el degradado normal a baja
   * opacidad solo se distinguían los ojos dorados, que son el detalle más
   * brillante: el resultado parecían dos puntos flotando.
   */
  silhouette?: boolean;
}) {
  if (silhouette) {
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={cn('size-8 shrink-0', className)}
        aria-hidden="true"
      >
        <path
          d="M24 4c-3.4 0-6.2 1.6-8.1 4.1-1.3-1.5-3-2.6-5-3.1.8 2.3.7 4.5-.2 6.4C8.2 13.6 6 17.4 6 21.8c0 3 1 5.6 2.7 7.6-1.5.6-2.8 1.7-3.7 3.1 2.2-.4 4.2-.1 5.9.8 1.3 3.6 4 6.5 7.5 8.1L18 44l6-2.2L30 44l-.4-2.6c3.5-1.6 6.2-4.5 7.5-8.1 1.7-.9 3.7-1.2 5.9-.8-.9-1.4-2.2-2.5-3.7-3.1 1.7-2 2.7-4.6 2.7-7.6 0-4.4-2.2-8.2-4.7-10.4.9-1.9.8-4.1-.2-6.4-2 .5-3.7 1.6-5 3.1C30.2 5.6 27.4 4 24 4Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      /*
        `shrink-0` NO es decorativo: sin él el dragón desaparece.

        La marca casi siempre va dentro de un `flex` al lado de la palabra
        «TAKU D&D», que con ese interletrado ocupa bastante. Un SVG es un hijo
        flexible con `min-width: auto` resuelto a 0, así que cuando el sitio
        aprieta se encoge hasta MEDIR CERO DE ANCHO: la altura queda bien, el
        dragón sigue dibujado a 38px dentro de un lienzo de 0, y lo único que
        asoma son los ojos. Medido en producción: `width: 0px` computado en los
        tres logos de la pantalla de perfil.

        Va acá y no en quien lo usa porque un logotipo no se encoge nunca: si
        no entra, lo que hay que arreglar es el sitio, no la marca.
      */
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="taku-scale" x1="10" y1="4" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-crimson-300)" />
          <stop offset="0.55" stopColor="var(--color-crimson-500)" />
          <stop offset="1" stopColor="var(--color-crimson-700)" />
        </linearGradient>
      </defs>
      {/* Cabeza y cuello */}
      <path
        d="M24 4c-3.4 0-6.2 1.6-8.1 4.1-1.3-1.5-3-2.6-5-3.1.8 2.3.7 4.5-.2 6.4C8.2 13.6 6 17.4 6 21.8c0 3 1 5.6 2.7 7.6-1.5.6-2.8 1.7-3.7 3.1 2.2-.4 4.2-.1 5.9.8 1.3 3.6 4 6.5 7.5 8.1L18 44l6-2.2L30 44l-.4-2.6c3.5-1.6 6.2-4.5 7.5-8.1 1.7-.9 3.7-1.2 5.9-.8-.9-1.4-2.2-2.5-3.7-3.1 1.7-2 2.7-4.6 2.7-7.6 0-4.4-2.2-8.2-4.7-10.4.9-1.9.8-4.1-.2-6.4-2 .5-3.7 1.6-5 3.1C30.2 5.6 27.4 4 24 4Z"
        fill="url(#taku-scale)"
      />
      {/* Ojos */}
      <circle cx="19" cy="20" r="2.1" fill="var(--surface-base)" />
      <circle cx="29" cy="20" r="2.1" fill="var(--surface-base)" />
      <circle cx="19.4" cy="19.6" r="0.9" fill="var(--color-gold-400)" />
      <circle cx="29.4" cy="19.6" r="0.9" fill="var(--color-gold-400)" />
      {/* Fauces */}
      <path
        d="M18 28c1.8 1.6 3.9 2.4 6 2.4s4.2-.8 6-2.4c-1.2 3-3.5 4.6-6 4.6s-4.8-1.6-6-4.6Z"
        fill="var(--surface-base)"
        fillOpacity="0.55"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const scale = {
    sm: { name: 'text-base', sub: 'text-[0.5rem]' },
    md: { name: 'text-xl', sub: 'text-[0.6rem]' },
    lg: { name: 'text-3xl', sub: 'text-xs' },
  }[size];

  return (
    <div className={cn('leading-none', className)}>
      <div className={cn('font-display font-bold tracking-[0.18em] text-[var(--text-primary)]', scale.name)}>
        TAKU
      </div>
      <div className={cn('mt-0.5 font-semibold tracking-[0.34em] text-[var(--accent-text)]', scale.sub)}>
        D&amp;D
      </div>
    </div>
  );
}

export function Logo({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const markSize = { sm: 'size-7', md: 'size-9', lg: 'size-14' }[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <DragonMark className={markSize} title="TAKU D&D" />
      <Wordmark size={size} />
    </div>
  );
}
