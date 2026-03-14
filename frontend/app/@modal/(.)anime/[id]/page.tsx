"use client";

import { Modal } from "@/components/Modal";
import { AnimeDetailView } from "@/components/AnimeDetailView";
import { useRouter, usePathname } from "next/navigation";

export default function AnimeDetailModal({ params }: { params: { id: string } }) {
    const router = useRouter();
    const pathname = usePathname();

    // If we are on a page other than the anime detail page (e.g., /watch/...), 
    // we hide the modal so the underlying content (like the player) is visible.
    // This preserves the intercepted route state so going back works perfectly.
    const isVisible = pathname === `/anime/${params.id}`;

    return (
        <Modal isOpen={isVisible} onClose={() => router.back()}>
            <div className="max-h-[90vh] overflow-y-auto scrollbar-none rounded-xl">
                <AnimeDetailView id={params.id} onClose={() => router.back()} />
            </div>
        </Modal>
    );
}
