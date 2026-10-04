export default function UiIcon({ name }: { name: 'coin' | 'collection' | 'close' | 'help' }) {
  return <svg className={`ui-icon icon-${name}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'coin' && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6" /><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3" /></>}
    {name === 'collection' && <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M6 6.5h.01M9 6.5h.01M13 13h5M13 16h5" /></>}
    {name === 'close' && <path d="M6 6l12 12M18 6L6 18" />}
    {name === 'help' && <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 16h.01" /></>}
  </svg>
}
