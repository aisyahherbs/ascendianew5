import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errMsg } from '../lib/api';
import { useCompany } from '../lib/company';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function Login() {
  const { login } = useAuth();
  const company = useCompany();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(id.trim().toUpperCase(), pw);
      nav('/');
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 md:p-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold leading-tight" data-testid="login-company-name">
                {company.company_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{company.company_tagline}</p>
            </div>
          </div>

          <h2 className="mt-7 font-display text-2xl font-semibold">Masuk ke akun Anda</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gunakan ID Member dan sandi yang diberikan admin.</p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">ID Member</Label>
              <Input
                className="h-11 font-mono"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="MB00001"
                data-testid="login-member-id-input"
                autoCapitalize="characters"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sandi</Label>
              <Input
                className="h-11"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••"
                data-testid="login-password-input"
              />
            </div>
            {err ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="login-error">
                {err}
              </p>
            ) : null}
            <Button type="submit" className="h-11" disabled={loading} data-testid="login-submit-button">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Masuk
            </Button>
          </form>

          <div className="mt-6 rounded-lg border bg-muted/60 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Akun admin awal
            </p>
            <p className="mt-1 font-mono">ADMIN / admin123 — segera ganti sandi setelah masuk.</p>
          </div>
        </div>
      </div>

      <div className="relative hidden border-l bg-[linear-gradient(135deg,rgba(237,230,221,0.9),rgba(251,250,248,1))] lg:block">
        <img
          src="https://images.pexels.com/photos/8102000/pexels-photo-8102000.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Tim distributor"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative flex h-full flex-col justify-center gap-6 px-12">
          <h3 className="font-display text-4xl font-semibold leading-tight text-[#132027]">
            Bisnis MLM Hybrid,<br />perhitungan bonus transparan.
          </h3>
          <ul className="grid gap-3 text-sm text-[#132027]">
            {[
              '7 bonus utama: Sponsor, Pasangan, Bimbingan, Prestasi, Kepemimpinan, Sharing Profit, Reward',
              'Tutup buku 2x sebulan (tanggal 11 & 27) dengan rincian rumus yang bisa diaudit',
              'Pohon Sponsor & Placement terpisah, sesuai aturan bonus pasangan',
              'Akses berjenjang: Admin Pusat, Admin Provinsi, Stokis, dan Member',
            ].map((t) => (
              <li key={t} className="flex gap-2 rounded-lg border bg-card/80 px-3 py-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
