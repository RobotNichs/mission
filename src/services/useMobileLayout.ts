import { useEffect, useState } from 'react'
export const MOBILE_QUERY = '(max-width: 768px)'
export default function useMobileLayout() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.(MOBILE_QUERY).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(MOBILE_QUERY)
    if (!media) return
    const update = () => setMobile(media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}
