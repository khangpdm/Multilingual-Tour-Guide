import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Toaster } from 'sonner'

export function AdminToaster() {
  const [container] = useState(() => {
    const element = document.createElement('div')
    element.id = 'admin-notifications'
    return element
  })

  useLayoutEffect(() => {
    document.body.appendChild(container)
    return () => container.remove()
  }, [container])

  return createPortal(<Toaster
    position="top-right"
    theme="light"
    richColors
    closeButton
    duration={5000}
    visibleToasts={3}
    mobileOffset={16}
    containerAriaLabel="Thông báo quản trị"
    toastOptions={{ closeButtonAriaLabel: 'Đóng thông báo' }}
    style={{ fontFamily: 'var(--font-display)' }}
  />, container)
}
