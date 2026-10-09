/** Ubah file gambar menjadi data URL terkompresi agar aman disimpan. */
export async function fileToCompressedDataUrl(file, maxSize = 900, quality = 0.78) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar');
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('Gagal membaca file'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Gambar tidak valid'));
    i.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#EDE6DD"/><text x="200" y="155" font-family="sans-serif" font-size="18" fill="#8A8078" text-anchor="middle">Tanpa Foto</text></svg>`
  );
