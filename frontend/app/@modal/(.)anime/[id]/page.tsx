"use client";

import { Modal } from "@/components/Modal";
import { AnimeDetailView } from "@/components/AnimeDetailView";
import { useRouter } from "next/navigation";

export default function AnimeDetailModal({ params }: { params: { id: string } }) {
  const router = useRouter();

  return (
    <Modal isOpen={true} onClose={() => router.back()}>
      <div className="max-h-[90vh] overflow-y-auto scrollbar-hide rounded-xl">
        <AnimeDetailView id={params.id} onClose={() => router.back()} />
      </div>
    </Modal>
  );
}
