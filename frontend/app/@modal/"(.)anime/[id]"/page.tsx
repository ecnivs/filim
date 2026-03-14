"use client";

import { Modal } from "@/components/Modal";
import { AnimeDetailView } from "@/components/AnimeDetailView";
import { useRouter } from "next/navigation";

export default function AnimeDetailModal({ params }: { params: { id: string } }) {
    const router = useRouter();

    return (
        <Modal isOpen={true} onClose={() => router.back()}>
            <AnimeDetailView id={params.id} onClose={() => router.back()} />
        </Modal>
    );
}
