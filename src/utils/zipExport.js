/**
 * zipExport.js
 * Creates a ZIP archive of all stem WAV files for bulk download.
 * Uses the JSZip-compatible approach via the File System Access API
 * or falls back to individual file downloads.
 */

/**
 * Trigger a browser download for a single Blob.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download all stems individually (fallback when no ZIP library is available).
 */
export function downloadAllIndividually(stems) {
  stems.forEach(({ name, blob }) => {
    downloadBlob(blob, `${name}.wav`);
  });
}

/**
 * Create and download a ZIP containing all stems.
 * Dynamically imports JSZip or falls back to individual downloads.
 */
export async function downloadAllAsZip(stems, onProgress) {
  try {
    // Dynamically load JSZip (if available via CDN or npm)
    const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip = new JSZip();
    const folder = zip.folder('stems');

    stems.forEach(({ name, blob }) => {
      folder.file(`${name}.wav`, blob);
    });

    onProgress?.('Creating ZIP archive...');
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      onProgress?.(`Compressing: ${meta.percent.toFixed(0)}%`);
    });

    downloadBlob(zipBlob, 'stems.zip');
    onProgress?.('ZIP download started!');
  } catch (err) {
    console.warn('JSZip not available, downloading individually:', err.message);
    downloadAllIndividually(stems);
  }
}