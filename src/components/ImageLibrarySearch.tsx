"use client";

import Image from 'next/image';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Search, Loader2, ExternalLink, Bookmark, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/firebase';

interface Result { id: string; previewUrl: string; imageUrl: string; width: number; height: number; alt: string; creatorName: string; creatorUrl?: string; sourceUrl: string; provider: string; attribution: string; }

export function ImageLibrarySearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Result | null>(null);
  const requestId = useRef(0);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2 || !user) { setMessage('Enter at least two characters to search.'); return; }
    const id = ++requestId.current;
    setLoading(true); setMessage(''); setPage(1);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/images/search?q=${encodeURIComponent(normalized)}&page=1`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(data.message || 'Image search failed.');
      setResults(data.results || []); setMessage(data.message || (data.results?.length ? '' : 'No images found for this search.'));
    } catch (error: any) { if (id === requestId.current) setMessage(error.message || 'Image search is unavailable.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }

  async function saveImage() {
    if (!selected || !user) return;
    const token = await user.getIdToken(true);
    const response = await fetch('/api/images/save', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(selected) });
    const data = await response.json();
    setMessage(response.ok ? 'Image saved to Saved Images.' : data.error || 'Could not save image.');
  }

  async function loadMore() {
    if (!user || loading || !results.length) return;
    setLoading(true);
    try {
      const token = await user.getIdToken(true);
      const nextPage = page + 1;
      const response = await fetch(`/api/images/search?q=${encodeURIComponent(query.trim())}&page=${nextPage}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load more images.');
      setResults((current) => [...current, ...(data.results || [])]); setPage(nextPage); setMessage(data.results?.length ? '' : 'No more images available.');
    } catch (error: any) { setMessage(error.message || 'Could not load more images.'); }
    finally { setLoading(false); }
  }

  return <section className="space-y-4" aria-labelledby="external-image-search-heading">
    <div><h2 id="external-image-search-heading" className="text-xl font-semibold">Search Images</h2><p className="text-sm text-muted-foreground">Find images from the configured free provider. Review attribution before using an image.</p></div>
    <form onSubmit={search} className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, services, or places" aria-label="Search external images" /><Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="sr-only">Search</span></Button></form>
    {message && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{message}</div>}
    {selected && <Card className="border-primary"><CardContent className="p-4 flex gap-4"><Image src={selected.previewUrl} alt={selected.alt} width={160} height={110} unoptimized className="h-24 w-32 rounded object-cover" /><div className="min-w-0"><p className="font-medium">Preview selected image</p><p className="text-sm text-muted-foreground">{selected.attribution}</p><a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">View source <ExternalLink className="h-3 w-3" /></a><div className="mt-2 flex gap-2"><Button size="sm" onClick={saveImage}>Save image</Button><Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(selected.imageUrl)}>Copy image URL</Button><Button size="sm" variant="outline" onClick={() => setSelected(null)}>Cancel</Button></div></div></CardContent></Card>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{results.map((image) => <Card key={`${image.provider}-${image.id}`} className="overflow-hidden"><CardContent className="p-0"><button className="block w-full text-left" onClick={() => setSelected(image)}><Image src={image.previewUrl} alt={image.alt} width={image.width || 400} height={image.height || 300} unoptimized className="h-32 w-full object-cover" loading="lazy" /></button></CardContent><CardFooter className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs text-muted-foreground">{image.creatorName}</span><Button size="icon" variant="ghost" title="Preview image" onClick={() => setSelected(image)}><Bookmark className="h-4 w-4" /></Button></CardFooter></Card>)}</div>
    {results.length > 0 && <div className="flex justify-center"><Button variant="outline" onClick={loadMore} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load more</Button></div>}
  </section>;
}
