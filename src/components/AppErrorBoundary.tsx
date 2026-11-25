import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  confirmLocalReset: boolean;
  isClearingCache: boolean;
}

const ReactComponent = React.Component as unknown as {
  new <P, S>(props: P): {
    readonly props: Readonly<P>;
    state: S;
    setState(
      state:
        | Partial<S>
        | ((prevState: Readonly<S>, props: Readonly<P>) => Partial<S> | null)
        | null,
      callback?: () => void
    ): void;
  };
};

export class AppErrorBoundary extends ReactComponent<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      confirmLocalReset: false,
      isClearingCache: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('AppErrorBoundary caught runtime error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearCacheAndReload = async (): Promise<void> => {
    this.setState({ isClearingCache: true });
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
      }
    } catch (err) {
      console.warn('Error clearing PWA cache:', err);
    } finally {
      window.location.reload();
    }
  };

  private handleResetLocalStorageAndReload = async (): Promise<void> => {
    if (!this.state.confirmLocalReset) {
      this.setState({ confirmLocalReset: true });
      return;
    }

    this.setState({ isClearingCache: true });
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dana_kematian_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (err) {
      console.warn('Error clearing localStorage:', err);
    }

    await this.handleClearCacheAndReload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage =
      this.state.error?.message || 'Terjadi kesalahan tak terduga saat memuat halaman.';
    const errorStack =
      this.state.error?.stack || this.state.errorInfo?.componentStack || '';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="w-full max-w-lg rounded-2xl bg-white border border-rose-200 shadow-xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Aplikasi Mengalami Gangguan Saat Dimuat
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Halaman tidak dapat ditampilkan karena error pada browser atau cache versi lama.
                Gunakan tombol pemulihan di bawah ini untuk memuat ulang versi terbaru.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900">
            <div className="font-semibold mb-1">Detail Kesalahan:</div>
            <div className="font-mono break-words">{errorMessage}</div>
          </div>

          {errorStack && (
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <summary className="cursor-pointer font-medium text-slate-800 select-none">
                Lihat Detail Teknis (untuk Pelaporan)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-slate-600">
                {errorStack}
              </pre>
            </details>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              disabled={this.state.isClearingCache}
              onClick={this.handleClearCacheAndReload}
              className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 transition cursor-pointer"
            >
              {this.state.isClearingCache
                ? 'Membersihkan Cache & Memuat Ulang...'
                : 'Muat Ulang & Bersihkan Cache Aplikasi'}
            </button>

            <button
              type="button"
              disabled={this.state.isClearingCache}
              onClick={this.handleReload}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition cursor-pointer"
            >
              Muat Ulang Biasa
            </button>

            <button
              type="button"
              disabled={this.state.isClearingCache}
              onClick={this.handleResetLocalStorageAndReload}
              className={`w-full rounded-xl border px-4 py-2 text-xs font-medium transition cursor-pointer ${
                this.state.confirmLocalReset
                  ? 'border-rose-400 bg-rose-600 text-white hover:bg-rose-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {this.state.confirmLocalReset
                ? 'Klik Sekali Lagi untuk Konfirmasi Reset Cache Data Lokal'
                : 'Reset Cache Data Lokal (Jika Masih Gagal)'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
