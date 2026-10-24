
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Wallpaper() {
  const pathname = usePathname();
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  const updateWallpaper = () => {
    try {
      const key = `wallpaper_${pathname}`;
      const storedUrl = localStorage.getItem(key);
      setWallpaperUrl(storedUrl);
    } catch (error) {
      console.error("Could not read from localStorage", error);
      setWallpaperUrl(null);
    }
  };

  useEffect(() => {
    updateWallpaper();

    // Listen for changes from other tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `wallpaper_${pathname}` || event.key === null) {
        updateWallpaper();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [pathname]);

  if (!wallpaperUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[-1] bg-cover bg-center transition-all duration-500"
      style={{ backgroundImage: `url(${wallpaperUrl})` }}
    />
  );
}
