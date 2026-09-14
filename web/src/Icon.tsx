// Project-owned Eztudy icons.
type IconName = 'route' | 'play' | 'ask' | 'menu' | 'left' | 'right' | 'close' | 'check' | 'trash' | 'attach'
const paths: Record<IconName, string[]> = {
  attach: ['M20.5 11.5l-8.8 8.8a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
  play: ['M8.5 6.5l9 5.5-9 5.5z'],
  route: ['M5 19c2.5 0 3.5-1.6 3.5-3.2S7.5 13 10 13h4c2.5 0 3.5-1.2 3.5-2.8S16.5 7 19 7', 'M5 17v4', 'M19 5v4'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  ask: ['M4 5h16v11H10l-5 4v-4H4z'],
  trash: ['M5 7h14', 'M10 11v6', 'M14 11v6', 'M7 7l1 13h8l1-13', 'M9 7V4h6v3'],
}
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
