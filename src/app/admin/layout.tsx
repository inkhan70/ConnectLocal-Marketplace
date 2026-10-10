
"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings, Users, Store, LogOut, Languages, Loader2, Megaphone, Library, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuth as useFirebaseAuth } from "@/firebase";
import { useEffect, useRef } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { bootstrapUserProfile } from "@/lib/bootstrap-client";

const sidebarNavItems = [
    {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        title: "Users",
        href: "/admin/users",
        icon: Users,
    },
    {
        title: "Subscriptions",
        href: "/admin/subscriptions",
        icon: CreditCard,
    },
    {
        title: "Categories",
        href: "/admin/categories",
        icon: Store,
    },
    {
        title: "Ads",
        href: "/admin/ads",
        icon: Megaphone,
    },
    {
        title: "Media",
        href: "/admin/media",
        icon: Library,
    },
    {
        title: "Appearance",
        href: "/admin/appearance",
        icon: Settings,
    },
    {
        title: "Languages",
        href: "/admin/languages",
        icon: Languages,
    },
];


export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, userProfile, loading } = useAuth();
    const firebaseAuth = useFirebaseAuth();
    const router = useRouter();
    // Force a token refresh so a claim granted moments ago (promotion, first sign-in) is picked up.
    const { isAdmin, checking } = useIsAdmin(true);
    const claimsChecked = !checking;
    const healing = useRef(false);

    useEffect(() => {
        if (!loading && claimsChecked && (!user || !isAdmin)) {
            router.replace('/');
        }
    }, [user, isAdmin, loading, claimsChecked, router]);

    // Signed-in admin whose profile document is missing: let the server recreate it instead of spinning forever.
    useEffect(() => {
        if (loading || !claimsChecked || !user || !isAdmin || userProfile || healing.current) return;
        healing.current = true;
        bootstrapUserProfile(user as any).catch((error) => console.error("Admin profile repair failed:", error));
    }, [loading, claimsChecked, user, isAdmin, userProfile]);

    const handleSignOut = async () => {
        if (!firebaseAuth) return;
        await firebaseAuth.signOut();
        router.push('/');
    };

    if (loading || !claimsChecked || !isAdmin || !userProfile) {
        return (
            <div className="container mx-auto my-8 flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto my-8">
            <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
                {/* Phones/tablets: the sidebar below is desktop-only, so give admins the same links as a scrollable bar. */}
                <nav className="lg:hidden col-span-full flex gap-2 overflow-x-auto pb-1 -mb-4">
                    {sidebarNavItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                                (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)))
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                        </Link>
                    ))}
                    <button onClick={handleSignOut} className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground">
                        <LogOut className="h-4 w-4" /><span>Logout</span>
                    </button>
                </nav>
                <aside className="hidden lg:flex flex-col space-y-6 p-4 bg-secondary/50 rounded-lg">
                   <div className="flex items-center space-x-3 p-2">
                       <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                           A
                       </div>
                       <div>
                           <p className="font-semibold">{userProfile.businessName || userProfile.fullName || 'Admin User'}</p>
                           <p className="text-xs text-muted-foreground">Administrator</p>
                       </div>
                   </div>
                    <nav className="flex flex-col space-y-1 flex-grow">
                        {sidebarNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-background",
                                    (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)))
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
                            <LogOut className="mr-2 h-4 w-4" /> Logout
                        </Button>
                    </div>
                </aside>
                <main className="bg-background rounded-lg shadow-sm border p-6 min-h-[60vh]">
                    {children}
                </main>
            </div>
        </div>
    );
}
