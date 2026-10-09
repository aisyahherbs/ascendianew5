import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Penangkap error render. Dipakai agar aplikasi tidak "putih" total ketika
 * terjadi error DOM (mis. ekstensi/penerjemah otomatis browser mengubah teks
 * halaman sehingga React gagal menyisipkan node).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const translasi = /insertBefore|removeChild|NotFoundError/i.test(String(error?.message || ''));
    return (
      <div className="flex min-h-screen items-center justify-center p-6" data-testid="error-boundary">
        <div className="w-full max-w-md rounded-xl border bg-card p-5">
          <h1 className="font-display text-xl font-semibold">Halaman perlu dimuat ulang</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {translasi
              ? 'Tampilan halaman diubah oleh fitur Terjemahkan otomatis browser sehingga aplikasi gagal menggambar ulang. Matikan "Terjemahkan halaman ini" di Chrome, lalu muat ulang.'
              : 'Terjadi kesalahan saat menampilkan halaman ini.'}
          </p>
          <p className="mt-2 break-words rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {String(error?.message || error)}
          </p>
          <Button className="mt-4 w-full" onClick={() => window.location.reload()}
            data-testid="error-boundary-reload">
            <RefreshCw className="mr-1.5 h-4 w-4" /> Muat ulang
          </Button>
        </div>
      </div>
    );
  }
}
