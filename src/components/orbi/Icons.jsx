// Small stroke icons drawn for UFQ (24px grid).
const PATHS = {
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>,
  pencil: <><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><path d="M14.5 6.5l3 3" /></>,
  trophy: <><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" /><path d="M12 14v4M8 20h8" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" /></>,
  pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  arrow: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
}

export default function Icon({ name, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {PATHS[name]}
    </svg>
  )
}

export function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" /></svg>
  )
}

export function Sparkle(props) {
  return (
    <svg className="ob-sparkle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M12 1l2.2 7.8L22 11l-7.8 2.2L12 21l-2.2-7.8L2 11l7.8-2.2z" /></svg>
  )
}

// Eight-point-star corner ornament (majolica turquoise).
export function Majolica() {
  return (
    <svg className="ob-majolica" viewBox="0 0 56 56" aria-hidden="true">
      <path d="M0 0h56v56C24 56 0 32 0 0z" fill="currentColor" opacity=".16" />
      <g transform="translate(36 20)" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M0 -13 L3.5 -5 L12 -9 L8 -1 L16 0 L8 3 L12 11 L3.5 7 L0 15 L-3.5 7 L-12 11 L-8 3 L-16 0 L-8 -1 L-12 -9 L-3.5 -5Z" transform="scale(.62)" />
        <circle r="2.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}
