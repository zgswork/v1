import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// pdfjs-dist crashes in jsdom because DOMMatrix is not defined there.
// Mock pdf-preview so the module never tries to import pdfjs at test time.
vi.mock('../preview/pdf-preview', () => ({
  loadPdf: vi.fn(),
  renderPage: vi.fn(),
  drawOverlay: vi.fn(),
  BASE_SCALE: 1.5,
}))

import App from './App'

describe('App', () => {
  it('renders title and drop zone before a file is chosen', () => {
    render(<App />)
    expect(screen.getByText('PDF 加水印')).toBeInTheDocument()
    expect(screen.getByText(/拖入 PDF/)).toBeInTheDocument()
  })
})
