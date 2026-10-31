"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Download, Save } from "lucide-react";

type Language = { code: string; nativeName: string; font: string; direction: 'ltr' | 'rtl'; fallback: string; enabled: boolean; published: boolean; version?: number; translations: Record<string, string> };
const empty: Language = { code: '', nativeName: '', font: 'PT Sans', direction: 'ltr', fallback: 'en', enabled: true, published: false, translations: {} };

export default function LanguagesPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selected, setSelected] = useState<Language>(empty);
  const [search, setSearch] = useState('');
  const [json, setJson] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const token = async () => user ? user.getIdToken() : '';
  const load = async () => { const response = await fetch('/api/admin/languages', { headers: { Authorization: `Bearer ${await token()}` } }); const data = await response.json(); setLanguages(data.languages || []); setLoading(false); };
  useEffect(() => { if (isAdmin) load().catch(() => setLoading(false)); }, [isAdmin]);
  const keys = useMemo(() => Object.keys(selected.translations).filter((key) => key.toLowerCase().includes(search.toLowerCase())).slice(0, 200), [selected.translations, search]);
  const completeness = useMemo(() => { const total = Object.keys(selected.translations).length; const filled = Object.values(selected.translations).filter(Boolean).length; return total ? Math.round((filled / total) * 100) : 0; }, [selected.translations]);
  const save = async (published = selected.published) => { setStatus('Saving…'); const response = await fetch('/api/admin/languages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ ...selected, published, translations: selected.translations }) }); const data = await response.json(); setStatus(response.ok ? `Saved version ${data.version}.` : data.error || 'Unable to save.'); if (response.ok) await load(); };
  const updateTranslation = (key: string, value: string) => setSelected((current) => ({ ...current, translations: { ...current.translations, [key]: value } }));
  const importJson = () => { try { const parsed = JSON.parse(json); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(); setSelected((current) => ({ ...current, translations: parsed })); setStatus('Imported dictionary preview. Save to create a version.'); } catch { setStatus('Invalid JSON dictionary.'); } };
  const exportJson = () => { const blob = new Blob([JSON.stringify(selected.translations, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${selected.code || 'language'}.json`; anchor.click(); URL.revokeObjectURL(url); };
  if (!isAdmin) return <p className="p-6 text-muted-foreground">Administrator access required.</p>;
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  return <div className="mx-auto flex max-w-7xl flex-col gap-6">
    <div><h1 className="text-2xl font-bold">Language Management</h1><p className="text-muted-foreground">Publish versioned dictionaries without redeploying. Missing values fall back to English.</p></div>
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <Card><CardHeader><CardTitle>Languages</CardTitle><CardDescription>Published languages are available to guests and members.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{languages.map((language) => <Button key={language.code} variant={selected.code === language.code ? 'secondary' : 'ghost'} className="justify-between" onClick={() => setSelected(language)}>{language.nativeName}<Badge variant={language.published ? 'secondary' : 'outline'}>{language.published ? 'Live' : 'Draft'}</Badge></Button>)}<Button variant="outline" onClick={() => setSelected(empty)}>Add language</Button></CardContent></Card>
      <div className="flex flex-col gap-6"><Card><CardHeader><CardTitle>{selected.code ? `Edit ${selected.nativeName}` : 'New language'}</CardTitle><CardDescription>Configure locale metadata, then edit or import stable translation keys.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Input aria-label="Language code" placeholder="pt-BR" value={selected.code} onChange={(event) => setSelected({ ...selected, code: event.target.value })} /><Input aria-label="Native name" placeholder="Português" value={selected.nativeName} onChange={(event) => setSelected({ ...selected, nativeName: event.target.value })} /><Input aria-label="Font" value={selected.font} onChange={(event) => setSelected({ ...selected, font: event.target.value })} /><Input aria-label="Fallback" value={selected.fallback} onChange={(event) => setSelected({ ...selected, fallback: event.target.value })} /><select aria-label="Direction" className="h-10 rounded-md border bg-background px-3" value={selected.direction} onChange={(event) => setSelected({ ...selected, direction: event.target.value as 'ltr' | 'rtl' })}><option value="ltr">LTR</option><option value="rtl">RTL</option></select><div className="flex items-center gap-2"><Button onClick={() => save(false)}><Save data-icon="inline-start" />Save draft</Button><Button variant="secondary" onClick={() => save(true)}>Publish</Button></div></CardContent></Card>
      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Dictionary editor</CardTitle><CardDescription>{completeness}% of loaded keys have values. Version {selected.version || 'new'}.</CardDescription></div><div className="flex gap-2"><Button variant="outline" onClick={exportJson}><Download data-icon="inline-start" />Export</Button><Button variant="outline" onClick={importJson}><Upload data-icon="inline-start" />Import preview</Button></div></div></CardHeader><CardContent className="flex flex-col gap-4"><Textarea aria-label="Import JSON" placeholder="Paste a JSON dictionary to preview it…" value={json} onChange={(event) => setJson(event.target.value)} /><Input aria-label="Search translation keys" placeholder="Search keys" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="grid max-h-[32rem] gap-3 overflow-auto">{keys.map((key) => <label key={key} className="grid gap-1 text-sm"><span className="font-mono text-muted-foreground">{key}</span><Input value={selected.translations[key] || ''} onChange={(event) => updateTranslation(key, event.target.value)} /></label>)}</div>{status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}</CardContent></Card></div>
    </div>
  </div>;
}
