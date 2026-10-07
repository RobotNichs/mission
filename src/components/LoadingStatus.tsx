import { useEffect, useState } from 'react'

export default function LoadingStatus({ text }: { text: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), 3000)
    return () => window.clearTimeout(timeout)
  }, [])
  return <div className="loading-status" role="status" aria-live="polite">
    <span className="loading-ring" aria-hidden="true" />
    <div><span>{text}</span>{slow && <small>Die Anfrage dauert etwas länger als gewöhnlich.</small>}</div>
  </div>
}
