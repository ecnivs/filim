"use client";

import { AnimeDetailView } from "@/components/AnimeDetailView";
import { useParams } from "next/navigation";

export default function AnimeDetailsPage() {
    const params = useParams<{ id: string }>();

    return (
        <div className="min-h-screen bg-background pt-20 pb-12">
            <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-neutral-900/40">
                <AnimeDetailView id={params.id} />
            </div>
        </div>
    );
}
