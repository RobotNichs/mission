export default function UiIcon({ name }: { name: 'coin' | 'collection' | 'close' | 'help' | 'home' | 'plan' | 'progress' }) {
  return <svg className={`ui-icon icon-${name}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'coin' && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6" /><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3" /></>}
    {name === 'collection' && <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M6 6.5h.01M9 6.5h.01M13 13h5M13 16h5" /></>}
    {name === 'close' && <path d="M6 6l12 12M18 6L6 18" />}
    {name === 'help' && <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 16h.01" /></>}
    {name === 'home' && <><path d="M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></>}
    {name === 'plan' && <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 12h6M9 17h4" /></>}
    {name === 'progress' && <><path d="M4 4v16h16M8 16v-4M13 16V8M18 16V5" /></>}
  </svg>
}
