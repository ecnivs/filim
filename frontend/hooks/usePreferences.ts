"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";

type PreferenceItem = {
    anime_id: string;
    in_list: boolean;
};

type PreferencesResponse = {
    items: PreferenceItem[];
};

export function usePreferences() {
    const queryClient = useQueryClient();

    const preferences = useQuery({
        queryKey: ["preferences"],
        queryFn: async () => {
            const res = await api.get<PreferencesResponse>("/user/preferences");
            return res.data.items;
        }
    });

    const getPreferenceForAnime = (animeId: string): PreferenceItem | undefined => {
        return preferences.data?.find((item) => item.anime_id === animeId);
    };

    const toggleList = useMutation({
        mutationFn: async (payload: { animeId: string; inList: boolean }) => {
            await api.post("/user/preferences/list", {
                anime_id: payload.animeId,
                in_list: payload.inList
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["preferences"] });
        }
    });

    const handleToggleList = (animeId: string) => {
        const current = getPreferenceForAnime(animeId);
        const nextInList = !current?.in_list;
        toggleList.mutate({ animeId, inList: nextInList });
    };

    return {
        preferences,
        getPreferenceForAnime,
        handleToggleList,
        isInList: (animeId: string) => getPreferenceForAnime(animeId)?.in_list ?? false,
    };
}
