import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveOrDownload } from './file-io'

afterEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error cleanup
  delete window.showSaveFilePicker
})

describe('saveOrDownload', () => {
  it('uses File System Access API when available', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn().mockResolvedValue({ write, close })
    const picker = vi.fn().mockResolvedValue({ createWritable })
    // @ts-expect-error inject
    window.showSaveFilePicker = picker

    await saveOrDownload('out.pdf', new Uint8Array([1, 2, 3]))

    expect(picker).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('writes only the view bytes, not the whole backing buffer', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn().mockResolvedValue({ write, close })
    const picker = vi.fn().mockResolvedValue({ createWritable })
    // @ts-expect-error inject
    window.showSaveFilePicker = picker

    const backing = new Uint8Array(10) // larger buffer
    const view = backing.subarray(2, 5) // length 3, byteOffset 2
    await saveOrDownload('out.pdf', view)

    const writtenBlob = write.mock.calls[0][0] as Blob
    expect(writtenBlob.size).toBe(3)
  })

  it('falls back to anchor download', async () => {
    const click = vi.fn()
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await saveOrDownload('out.pdf', new Uint8Array([1, 2, 3]))

    expect(click).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('out.pdf')
  })
})
