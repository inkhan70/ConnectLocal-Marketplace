
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";

export function WallpaperManager() {
    const pathname = usePathname();
    // In a real app, this would be determined by checking if a user is logged in.
    // We'll assume the user is a member for now.
    const isMember = true; 

    if (!isMember) {
        return null;
    }

    return (
        <div className="absolute top-4 right-4 z-10">
            <Button asChild variant="outline">
                <Link href={`/admin/appearance?page=${pathname}`}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Add/Remove Wallpaper
                </Link>
            </Button>
        </div>
    );
}
