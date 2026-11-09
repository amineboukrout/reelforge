// Full-resolution downloads. The original output file is streamed through the
// local server (/dl) because output CDNs typically don't allow cross-origin
// fetches. Nothing is recompressed.

function extFromUrl(url: string, fallback: string) {
  const m = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(new URL(url).pathname);
  return m ? m[1].toLowerCase() : fallback;
}

export function downloadName(base: string, url: string, kind: 'image' | 'video') {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reelforge';
  return `${slug}-${Date.now().toString(36)}.${extFromUrl(url, kind === 'video' ? 'mp4' : 'png')}`;
}

export function downloadFile(url: string, name: string) {
  const a = document.createElement('a');
  a.href = `./dl?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
