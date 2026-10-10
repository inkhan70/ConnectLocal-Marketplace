
"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BusinessShareCard } from "@/components/BusinessShareCard";
import { Button } from "@/components/ui/button";
import { ShoppingBag, LayoutDashboard, Settings, MessageSquare, Bell, UserCircle, Image as ImageIconLucide, LogOut, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useAuth as useFirebaseAuth } from "@/firebase";
import { useEffect, useRef, useState } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { bootstrapUserProfile } from "@/lib/bootstrap-client";

const businessSidebarNavItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Products",
        href: "/dashboard/products",
        icon: ShoppingBag,
    },
    {
        title: "Images",
        href: "/dashboard/images",
        icon: ImageIconLucide,
    },
    {
        title: "Orders",
        href: "/dashboard/orders",
        icon: Bell,
    },
    {
        title: "Chat",
        href: "/dashboard/chat",
        icon: MessageSquare,
    },
    {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
    },
];

const buyerSidebarNavItems = [
     {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Purchase History",
        href: "/dashboard/orders",
        icon: Bell,
    },
    {
        title: "Chat",
        href: "/dashboard/chat",
        icon: MessageSquare,
    },
    {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
    },
]


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, userProfile, loading } = useAuth();
    const firebaseAuth = useFirebaseAuth();
    const router = useRouter();

    const { isAdmin, checking: adminChecking } = useIsAdmin();
    const [profileError, setProfileError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const healing = useRef(false);

    useEffect(() => {
        if (loading || adminChecking) return;
        if (!user || !user.emailVerified) {
            router.push('/signin');
        } else if (isAdmin) {
            // Administrators use the admin workspace; they never go through role selection.
            if (pathname === '/dashboard') router.replace('/admin');
        } else if (!userProfile) {
            // Signed in but no profile document (e.g. the first bootstrap call failed): ask the server to create it.
            if (healing.current) return;
            healing.current = true;
            setProfileError(null);
            bootstrapUserProfile(user as any, { role: 'buyer', fullName: user.displayName || '' })
                .catch((error: any) => {
                    console.error('Profile repair failed:', error);
                    setProfileError(error?.message || 'Could not load your profile.');
                });
        } else if (userProfile.needsRoleSelection) {
            router.replace('/select-role');
        }
    }, [user, userProfile, loading, adminChecking, isAdmin, pathname, router, retryKey]);

    const handleSignOut = async () => {
        if (!firebaseAuth) return;
        await firebaseAuth.signOut();
        router.push('/');
    };

    if (profileError && user && !userProfile && !isAdmin) {
        return (
            <div className="container mx-auto my-8 flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
                <p className="font-semibold">We couldn't load your account profile.</p>
                <p className="max-w-md text-sm text-muted-foreground">{profileError}</p>
                <div className="flex gap-3">
                    <Button onClick={() => { healing.current = false; setProfileError(null); setRetryKey(k => k + 1); }}>Try again</Button>
                    <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
                </div>
            </div>
        );
    }

    if (loading || adminChecking || !user || !user.emailVerified || (!isAdmin && (!userProfile || userProfile.needsRoleSelection))) {
        return (
            <div className="container mx-auto my-8 flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const isBusiness = userProfile?.role && userProfile.role !== 'buyer';
    const sidebarNavItems = isBusiness ? businessSidebarNavItems : buyerSidebarNavItems;


    const capitalizeFirstLetter = (string: string) => {
        if (!string) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    return (
        <div className="container mx-auto my-8">
            <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
                {/* Phones/tablets: the sidebar below is desktop-only, so show the same links as a scrollable bar. */}
                <nav className="lg:hidden col-span-full flex gap-2 overflow-x-auto pb-1 -mb-4">
                    {sidebarNavItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)))
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                        </Link>
                    ))}
                    {isAdmin && (
                        <Link href="/admin" className="flex shrink-0 items-center gap-2 rounded-full border border-primary px-3 py-1.5 text-sm font-semibold text-primary">
                            Admin Panel
                        </Link>
                    )}
                </nav>
                <aside className="hidden lg:flex flex-col space-y-6 p-4 bg-secondary/50 rounded-lg">
                   <div className="flex items-center space-x-3 p-2">
                       <UserCircle className="w-10 h-10 text-muted-foreground" />
                       <div>
                           <p className="font-semibold text-sm">{userProfile?.businessName || userProfile?.fullName || 'User'}</p>
                           <p className="text-xs text-muted-foreground">{userProfile?.role ? capitalizeFirstLetter(userProfile.role) : 'User'}</p>
                       </div>
                   </div>
                    <nav className="flex flex-col space-y-1 flex-grow">
                        {sidebarNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-background",
                                    (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)))
                                        ? "bg-background text-primary-foreground shadow-sm"
                                        : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-auto">
                        <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" /> Sign Out
                        </Button>
                    </div>
                </aside>
                <main className="bg-background rounded-lg shadow-sm border p-6 min-h-[60vh]">
                    {isBusiness && <div className="mb-6"><BusinessShareCard /></div>}
                    {children}
                </main>
            </div>
        </div>
    );
}
