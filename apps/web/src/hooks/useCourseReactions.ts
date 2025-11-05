// hooks/useCourseReactions.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export type ReactionType = 'like' | 'love' | 'wow';

interface ReactionData {
  userReaction: ReactionType | null;
  totalReactions: number;
}

export function useCourseReactions(courseId: string) {
  return useQuery<ReactionData>({
    queryKey: ['course-reactions', courseId],
    queryFn: async () => {
      const res = await axios.get<ReactionData>(`/api/reactions/course/${courseId}`);
      return res.data;
    },
    staleTime: 60_000, // 1 minute cache
    retry: false,
  });
}
