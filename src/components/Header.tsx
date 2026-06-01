
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, Menu, LogOut, Search, Heart, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { Cart } from './Cart';

export function Header() {
  const { language, setLanguage, t, availableLanguages } = useLanguage();
  const { user } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const router = useRouter();
  
  const handleSignOut = async () => {
      await signOut(firebaseAuth);
      router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-6 w-6"><rect width="256" height="256" fill="none"></rect><path d="M128,24a104,104,0,1,0,104,104A104.2,104.2,0,0,0,128,24Zm0,176a72,72,0,1,1,72-72A72.1,72.1,0,0,1,128,200Z" fill="hsl(var(--primary))"></path><path d="M168,104a40,40,0,1,1-40-40,40,40,0,0,1,40,40" fill="hsl(var(--primary))" opacity="0.5"></path></svg>
            <span className="font-bold font-headline text-lg">business_web</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/categories" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('header.categories')}</Link>
            <Link href="/favorites" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                <Heart className="h-4 w-4" /> Favorites
            </Link>
            {user && user.emailVerified && <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('header.dashboard')}</Link>}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="hidden md:flex items-center space-x-2">
            <Cart />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/categories">{t('header.categories')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/favorites" className="flex items-center gap-2">
                    <Heart className="h-4 w-4" /> Favorites
                  </Link>
                </DropdownMenuItem>
                {user && user.emailVerified && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">{t('header.dashboard')}</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <div className="flex items-center gap-2 cursor-pointer w-full">
                    <Globe className="h-4 w-4" />
                    <span>Language</span>
                  </div>
                </DropdownMenuItem>
                <div className="px-2 py-1.5">
                  <ScrollArea className="h-auto max-h-48">
                    <div className="flex flex-col space-y-1 pl-6">
                      {availableLanguages.map(lang => (
                        <button
                          key={lang.code}
                          className={`text-left text-sm px-2 py-1.5 rounded transition-colors hover:bg-muted ${language === lang.code ? 'bg-muted font-semibold' : ''}`}
                          onClick={() => setLanguage(lang.code as any)}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="border-t py-2">
                  {user ? (
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/signin">{t('header.sign_in')}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/signup">{t('header.sign_up')}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
        
        <div className="md:hidden flex items-center ml-auto">
            <Cart />
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right">
                    <SheetHeader>
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    </SheetHeader>
                    <Link href="/" className="mr-6 flex items-center space-x-2 mb-6">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-6 w-6"><rect width="256" height="256" fill="none"></rect><path d="M128,24a104,104,0,1,0,104,104A104.2,104.2,0,0,0,128,24Zm0,176a72,72,0,1,1,72-72A72.1,72.1,0,0,1,128,200Z" fill="hsl(var(--primary))"></path><path d="M168,104a40,40,0,1,1-40-40,40,40,0,0,1,40,40" fill="hsl(var(--primary))" opacity="0.5"></path></svg>
                        <span className="font-bold font-headline text-lg">business_web</span>
                    </Link>
                    <div className="flex flex-col space-y-4">
                        <Link href="/categories" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('header.categories')}</Link>
                        <Link href="/favorites" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                            <Heart className="h-4 w-4" /> Favorites
                        </Link>
                         {user && user.emailVerified && <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">{t('header.dashboard')}</Link>}
                        
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1" className="border-b-0">
                                <AccordionTrigger className="transition-colors hover:text-foreground/80 text-foreground/60 py-0 font-medium hover:no-underline">
                                    <div className="flex items-center space-x-2">
                                        <Globe className="h-5 w-5" />
                                        <span>Language</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-0">
                                     <ScrollArea className="h-auto max-h-48">
                                        <div className="pl-7 flex flex-col space-y-2">
                                            {availableLanguages.map(lang => (
                                                <button
                                                    key={lang.code}
                                                    className={`text-left text-sm transition-colors hover:text-foreground/80 ${language === lang.code ? 'text-foreground font-semibold' : 'text-foreground/60'}`}
                                                    onClick={() => {
                                                        setLanguage(lang.code as any)
                                                        // Optionally close the sheet here
                                                    }}
                                                >
                                                    {lang.name}
                                                </button>
                                            ))}
                                        </div>
                                     </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        
                        <div className="pt-4 border-t">
                            {user ? (
                                <button onClick={handleSignOut} className="transition-colors hover:text-foreground/80 text-foreground/60 w-full text-left">{t('header.sign_out')}</button>
                            ) : (
                                <>
                                 <Link href="/signin" className="transition-colors hover:text-foreground/80 text-foreground/60 block mb-4">{t('header.sign_in')}</Link>
                                 <Button asChild className="w-full">
                                   <Link href="/signup">{t('header.sign_up')}</Link>
                                 </Button>
                                </>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>

      </div>
    </header>
  );
}
