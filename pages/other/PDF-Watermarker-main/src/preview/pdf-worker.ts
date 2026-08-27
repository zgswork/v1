// Custom pdf.js worker entry: apply the Uint8Array hex/base64 polyfills in the
// worker's own global scope (the main-thread polyfill doesn't reach it) before
// loading the real pdf.js worker, which calls toHex()/fromBase64() internally.
import '../polyfills'
import 'pdfjs-dist/build/pdf.worker.min.mjs'
