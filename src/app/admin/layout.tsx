
"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings, Users, Store, LogOut, Languages, Loader2, Megaphone, Library, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuth as useFirebaseAuth } from "@/firebase";
import { useEffect } from "react";
import { signOut } from "firebase/auth";


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

    useEffect(() => {
        if (!loading) {
            if (!user || !userProfile?.isAdmin) {
                router.replace('/');
            }
        }
    }, [user, userProfile, loading, router]);
    
    const handleSignOut = async () => {
        if (!firebaseAuth) return;
        await signOut(firebaseAuth);
        router.push('/');
    };

    if (loading || !userProfile || !userProfile.isAdmin) {
        return (
            <div className="container mx-auto my-8 flex justify-center items-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto my-8">
            <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
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
