import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff, Loader2, Lock, Save, ShieldOff, UserCog } from 'lucide-react';
import AppShell from '../components/AppShell';
import RegionSelect from '../components/RegionSelect';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { clearCompanyCache } from '../lib/company';
import { num } from '../lib/format';

const MEM = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const RANKS = ['Member', 'VIP', 'Royal Star', 'Crown Star', 'Leader Ambassador', 'Leader Majestic', 'Director', 'Executive Director'];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [st, setSt] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ old_password: '', new_password: '' });
  const [me, setMe] = useState({ name: '', phone: '', email: '', province: '', city: '' });
  const [savingMe, setSavingMe] = useState(false);
  const [access, setAccess] = useState(null);
  const [bonusOff, setBonusOff] = useState([]);
  const [pagesOff, setPagesOff] = useState({});

  const load = async () => {
    try {
      const { data } = await api.get('/settings');
      setSt(data.settings);
      setCfg(data.engine_config);
      const { data: acc } = await api.get('/access/options');
      setAccess(acc);
      setBonusOff(acc.bonus_disabled_global || []);
      setPagesOff(acc.pages_blocked_global || {});
    } catch (e) { toast.error(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (user) {
      setMe({
        name: user.name || '', phone: user.phone || '', email: user.email || '',
        province: user.province || '', city: user.city || '',
      });
    }
  }, [user]);

  const saveMe = async () => {
    setSavingMe(true);
    try {
      const { data } = await api.put('/me', me);
      setUser(data.user);
      localStorage.setItem('mlm_user', JSON.stringify(data.user));
      toast.success('Profil Anda diperbarui');
    } catch (e) { toast.error(errMsg(e)); } finally { setSavingMe(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const engine = {
        memberships: MEM.reduce((a, m) => ({ ...a, [m]: {
          threshold: Number(cfg.memberships[m].threshold),
          sponsor: Number(cfg.memberships[m].sponsor),
          pairing: Number(cfg.memberships[m].pairing),
          cap: Number(cfg.memberships[m].cap),
          bimbingan_gen: Number(cfg.memberships[m].bimbingan_gen),
        } }), {}),
        prestasi_rate: RANKS.reduce((a, r) => ({ ...a, [r]: Number(cfg.prestasi_rate[r]) }), {}),
        tupo: RANKS.reduce((a, r) => ({ ...a, [r]: Number(cfg.tupo[r]) }), {}),
        pairing_cap_majestic: Number(cfg.pairing_cap_majestic),
        bimbingan_rate: Number(cfg.bimbingan_rate),
        reward_pool_rate: Number(cfg.reward_pool_rate),
        sharing_profit: { Director: Number(cfg.sharing_profit.Director), 'Executive Director': Number(cfg.sharing_profit['Executive Director']) },
      };
      await api.put('/settings', {
        company_name: st.company_name,
        company_tagline: st.company_tagline,
        period1_end_day: Number(st.period1_end_day),
        period1_close_day: Number(st.period1_close_day),
        period2_close_day: Number(st.period2_close_day),
        stokis_fee_percent: Number(st.stokis_fee_percent),
        bonus_disabled_global: bonusOff,
        pages_blocked_global: pagesOff,
        engine,
      });
      clearCompanyCache();
      toast.success('Pengaturan disimpan & bonus dihitung ulang');
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  const changePw = async () => {
    try {
      await api.post('/auth/change-password', pw);
      toast.success('Sandi Anda diperbarui');
      setPw({ old_password: '', new_password: '' });
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!st || !cfg) return <AppShell title="Pengaturan"><p className="text-sm text-muted-foreground">Memuat...</p></AppShell>;

  const setMem = (m, k, v) => setCfg({ ...cfg, memberships: { ...cfg.memberships, [m]: { ...cfg.memberships[m], [k]: v } } });

  return (
    <AppShell title="Pengaturan Sistem" subtitle="Ubah tanggal tutup buku, fee stokis, dan parameter bonus"
      actions={<Button onClick={save} disabled={saving} data-testid="settings-save">{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Simpan</Button>}>
      <div className="grid gap-4 md:gap-6">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <UserCog className="h-4 w-4" /> Profil Saya
          </h3>
          <p className="text-xs text-muted-foreground">
            Ubah nama Anda sendiri (tampil di sidebar dan seluruh laporan).
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Nama saya</Label>
              <Input className="h-11" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} data-testid="settings-my-name" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">No. HP</Label>
              <Input className="h-11" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} data-testid="settings-my-phone" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Email</Label>
              <Input className="h-11" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} data-testid="settings-my-email" />
            </div>
            <RegionSelect
              province={me.province}
              city={me.city}
              onChange={({ province, city }) => setMe((p) => ({ ...p, province, city }))}
              testid="settings-my-region"
            />
            <div className="flex items-end">
              <Button variant="outline" onClick={saveMe} disabled={savingMe} data-testid="settings-save-profile">
                {savingMe ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Simpan Profil
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-base font-semibold">Umum & Periode</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Nama perusahaan</Label>
              <Input className="h-11" value={st.company_name || ''} onChange={(e) => setSt({ ...st, company_name: e.target.value })} data-testid="settings-company" /></div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Tagline perusahaan</Label>
              <Input className="h-11" value={st.company_tagline || ''} onChange={(e) => setSt({ ...st, company_tagline: e.target.value })} data-testid="settings-company-tagline" /></div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Batas hari Periode 1</Label>
              <Input className="h-11 font-mono" type="number" value={st.period1_end_day} onChange={(e) => setSt({ ...st, period1_end_day: e.target.value })} data-testid="settings-p1-end" /></div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Fee perantara stokis (%)</Label>
              <Input className="h-11 font-mono" type="number" step="0.1" value={st.stokis_fee_percent} onChange={(e) => setSt({ ...st, stokis_fee_percent: e.target.value })} data-testid="settings-stokis-fee" /></div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Tanggal tutup buku Periode 1</Label>
              <Input className="h-11 font-mono" type="number" value={st.period1_close_day} onChange={(e) => setSt({ ...st, period1_close_day: e.target.value })} data-testid="settings-p1-close" /></div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Tanggal tutup buku Periode 2</Label>
              <Input className="h-11 font-mono" type="number" value={st.period2_close_day} onChange={(e) => setSt({ ...st, period2_close_day: e.target.value })} data-testid="settings-p2-close" /></div>
          </div>
        </div>

        {access ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[hsl(var(--danger)/0.3)] bg-card p-4" data-testid="settings-bonus-off-card">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <ShieldOff className="h-4 w-4 text-[hsl(var(--danger))]" /> Nonaktifkan Jenis Bonus (semua member)
              </h3>
              <p className="mt-1 flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
                <EyeOff className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                Bonus yang dicentang tidak dihitung sama sekali untuk seluruh member (0 BV, tanpa baris rincian).
                Member tidak diberi tahu dan tidak bisa melihat pengaturan ini.
              </p>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {(access.bonus_types || []).map((b) => {
                  const on = bonusOff.includes(b.key);
                  return (
                    <label key={b.key}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] ${
                        on ? 'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.08)] font-medium' : 'bg-muted/30'
                      }`}>
                      <input type="checkbox" className="h-4 w-4 accent-[#DC2626]" checked={on}
                        onChange={() => setBonusOff(on ? bonusOff.filter((k) => k !== b.key) : [...bonusOff, b.key])}
                        data-testid={`settings-bonus-off-${b.key}`} />
                      {b.label}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Untuk menonaktifkan bonus hanya pada member tertentu, gunakan tombol
                <b> Bonus &amp; Akses</b> di halaman Member.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4" data-testid="settings-pages-off-card">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <Lock className="h-4 w-4 text-[hsl(var(--warning-soft-foreground))]" /> Tutup Halaman per Peran
              </h3>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                Halaman yang dicentang hilang dari menu peran tersebut dan datanya ditolak server.
                Dashboard &amp; Pengaturan tidak bisa ditutup.
              </p>
              <div className="mt-3 grid gap-3">
                {(access.roles || []).map((r) => {
                  const list = (access.pages || []).filter((p) => p.roles.includes(r.key));
                  const cur = pagesOff[r.key] || [];
                  const toggle = (key) => setPagesOff({
                    ...pagesOff,
                    [r.key]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
                  });
                  return (
                    <div key={r.key} className="rounded-lg border bg-muted/20 p-2.5">
                      <p className="text-[12px] font-semibold">{r.label}
                        <span className="ml-1.5 text-[10.5px] font-normal text-muted-foreground">
                          {cur.length ? `${cur.length} halaman ditutup` : 'semua halaman terbuka'}
                        </span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {list.map((p) => {
                          const on = cur.includes(p.key);
                          return (
                            <label key={p.key}
                              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] ${
                                on ? 'border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.08)] font-medium' : 'bg-card'
                              }`}>
                              <input type="checkbox" className="h-3.5 w-3.5 accent-[#DC2626]" checked={on}
                                onChange={() => toggle(p.key)}
                                data-testid={`settings-page-off-${r.key}-${p.key}`} />
                              {p.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Membership</h3></div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Membership</th><th className="px-2 py-2 text-left">PV Syarat</th><th className="px-2 py-2 text-left">Rate Sponsor</th><th className="px-2 py-2 text-left">Rate Pasangan</th><th className="px-2 py-2 text-left">Maks Pasangan (BV)</th><th className="px-4 py-2 text-left">Generasi Bimbingan</th></tr>
              </thead>
              <tbody>
                {MEM.map((m) => (
                  <tr key={m} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{m}</td>
                    {['threshold', 'sponsor', 'pairing', 'cap', 'bimbingan_gen'].map((k) => (
                      <td key={k} className="px-2 py-2">
                        <Input className="h-9 w-28 font-mono" type="number" step={k === 'sponsor' || k === 'pairing' ? '0.01' : '1'}
                          value={cfg.memberships[m][k]} onChange={(e) => setMem(m, k, e.target.value)} data-testid={`settings-${m}-${k}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-muted-foreground">Rate ditulis dalam desimal, contoh 0.2 untuk 20%.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Bonus Prestasi & Tupo per Peringkat</h3></div>
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-2 text-left">Peringkat</th><th className="px-2 py-2 text-left">Rate Prestasi</th><th className="px-4 py-2 text-left">Tupo (PV)</th></tr>
                </thead>
                <tbody>
                  {RANKS.map((r) => (
                    <tr key={r} className="border-b last:border-0">
                      <td className="px-4 py-2">{r}</td>
                      <td className="px-2 py-2"><Input className="h-9 w-24 font-mono" type="number" step="0.01" value={cfg.prestasi_rate[r]}
                        onChange={(e) => setCfg({ ...cfg, prestasi_rate: { ...cfg.prestasi_rate, [r]: e.target.value } })} data-testid={`settings-prestasi-${r}`} /></td>
                      <td className="px-4 py-2"><Input className="h-9 w-24 font-mono" type="number" value={cfg.tupo[r]}
                        onChange={(e) => setCfg({ ...cfg, tupo: { ...cfg.tupo, [r]: e.target.value } })} data-testid={`settings-tupo-${r}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-display text-base font-semibold">Parameter Lain</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Maks pasangan Leader Majestic (BV)</Label>
                  <Input className="h-11 font-mono" type="number" value={cfg.pairing_cap_majestic} onChange={(e) => setCfg({ ...cfg, pairing_cap_majestic: e.target.value })} data-testid="settings-cap-majestic" /></div>
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Rate bimbingan per generasi</Label>
                  <Input className="h-11 font-mono" type="number" step="0.01" value={cfg.bimbingan_rate} onChange={(e) => setCfg({ ...cfg, bimbingan_rate: e.target.value })} data-testid="settings-bimbingan" /></div>
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Sharing profit Director</Label>
                  <Input className="h-11 font-mono" type="number" step="0.01" value={cfg.sharing_profit.Director}
                    onChange={(e) => setCfg({ ...cfg, sharing_profit: { ...cfg.sharing_profit, Director: e.target.value } })} data-testid="settings-sharing-director" /></div>
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Sharing profit Exec. Director</Label>
                  <Input className="h-11 font-mono" type="number" step="0.01" value={cfg.sharing_profit['Executive Director']}
                    onChange={(e) => setCfg({ ...cfg, sharing_profit: { ...cfg.sharing_profit, 'Executive Director': e.target.value } })} data-testid="settings-sharing-exec" /></div>
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Pool Special Reward</Label>
                  <Input className="h-11 font-mono" type="number" step="0.01" value={cfg.reward_pool_rate} onChange={(e) => setCfg({ ...cfg, reward_pool_rate: e.target.value })} data-testid="settings-reward" /></div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-display text-base font-semibold">Ganti Sandi Saya</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Sandi lama</Label>
                  <Input className="h-11" type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} data-testid="settings-old-password" /></div>
                <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Sandi baru</Label>
                  <Input className="h-11" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} data-testid="settings-new-password" /></div>
              </div>
              <Button className="mt-3" variant="outline" onClick={changePw} data-testid="settings-change-password">Ganti Sandi</Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
