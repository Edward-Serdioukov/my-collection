import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = (_blob: Blob | MediaSource) =>
      `blob:mock-url-${Math.random().toString(36).substring(2, 9)}`
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {}
  }
}

afterEach(() => {
  cleanup()
})
