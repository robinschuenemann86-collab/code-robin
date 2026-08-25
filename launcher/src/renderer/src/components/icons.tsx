import type { ReactElement, SVGProps } from 'react'

// Schlankes, selbst gezeichnetes Icon-Set (keine Bibliothek nötig) — alle Icons
// nutzen currentColor, erben also automatisch Text-/Akzentfarbe und Größe (className).
type IconProps = SVGProps<SVGSVGElement> & { title?: string }

function base(props: IconProps, children: ReactElement): ReactElement {
  const { className = 'h-4 w-4', title, ...rest } = props
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

export function IconPlus(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  )
}

export function IconSearch(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  )
}

export function IconGrid(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  )
}

export function IconList(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  )
}

export function IconTrash(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  )
}

export function IconEdit(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L4.5 17z" />
    </>
  )
}

export function IconPlay(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M7 4.5v15l13-7.5z" />
    </>
  )
}

export function IconX(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  )
}

export function IconTag(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M4 11.5V5a1 1 0 0 1 1-1h6.5a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" />
      <circle cx="8.2" cy="8.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  )
}

export function IconFolder(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
    </>
  )
}

export function IconDisc(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 14h18" />
      <circle cx="8" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  )
}

export function IconCalendar(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  )
}

export function IconDownload(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4.5 19.5h15" />
    </>
  )
}

export function IconCheck(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </>
  )
}

export function IconAlertTriangle(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M12 3.5 22 20H2Z" />
      <path d="M12 9.5v5M12 17.5h.01" />
    </>
  )
}

export function IconExpand(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </>
  )
}

export function IconMore(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </>
  )
}

export function IconApps(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M10 4v16" />
    </>
  )
}

export function IconStar(props: IconProps & { filled?: boolean }): ReactElement {
  const { filled, ...rest } = props
  return base(
    { ...rest, fill: filled ? 'currentColor' : 'none' },
    <>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z" />
    </>
  )
}

export function IconClock(props: IconProps): ReactElement {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  )
}
