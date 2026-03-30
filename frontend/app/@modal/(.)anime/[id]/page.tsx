"use client";

import { Modal } from "@/components/Modal";
import { AnimeDetailView } from "@/components/AnimeDetailView";
import { useRouter, usePathname } from "next/navigation";

export default function AnimeDetailModal({ params }: { params: { id: string } }) {
    const router = useRouter();
    const pathname = usePathname();


    const isVisible = pathname === `/anime/${params.id}`;

    return (
        <Modal isOpen={isVisible} onClose={() => router.back()}>
            <div className="max-h-[90vh] overflow-y-auto scrollbar-none rounded-xl">
                <AnimeDetailView id={params.id} onClose={() => router.back()} />
            </div>
        </Modal>
    );
}
