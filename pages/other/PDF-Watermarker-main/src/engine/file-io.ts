export async function saveOrDownload(filename: string, bytes: Uint8Array): Promise<void> {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })

  if ('showSaveFilePicker' in window) {
    // @ts-expect-error experimental API
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
