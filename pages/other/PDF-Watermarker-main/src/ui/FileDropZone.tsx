interface Props {
  onFile: (bytes: Uint8Array, name: string) => void
}

export function FileDropZone({ onFile }: Props) {
  async function handle(file: File) {
    if (file.type !== 'application/pdf') {
      alert('请选择 PDF 文件')
      return
    }
    onFile(new Uint8Array(await file.arrayBuffer()), file.name)
  }
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) handle(f)
      }}
      style={{ border: '2px dashed #ccc', padding: 32, textAlign: 'center', borderRadius: 8 }}
    >
      <p>拖入 PDF，或</p>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handle(f)
        }}
      />
    </div>
  )
}
