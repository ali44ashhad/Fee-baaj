// hooks/useReactToCourse.ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';


type ReactionType = 'like' | 'love' | 'wow';

type PayloadCreate = { courseId: string; type: ReactionType };
type PayloadRemove = { courseId: string; action: 'remove' };
type Payload = PayloadCreate | PayloadRemove;

// (optional) Minimal shape for cached reaction data we update
interface CourseReactionsCache {
  userReaction?: ReactionType | null;
  totalReactions?: number;
}

export function useReactToCourse() {
  const qc = useQueryClient();
   
  const environment = process.env.NODE_ENV === 'production';

  const url = environment ? "/api" : process.env.NEXT_PUBLIC_API_URL
  

  return useMutation<any, unknown, Payload>({
    mutationFn: async (payload: Payload) => {
      if ('action' in payload && payload.action === 'remove') {
        // axios.delete with body
        const res = await axios.delete(`${url}/courses/reaction_delete`, {
          data: { courseId: payload.courseId },
          withCredentials: true,
        });
        return res.data;
      } else {
        const { courseId, type } = payload as PayloadCreate;
        const res = await axios.post(`${url}/courses/reaction_course`, { courseId, type }, { withCredentials: true });
        return res.data;
      }
    },
    onSuccess: (_data, variables) => {
      const courseId = (variables as any).courseId;

      // Use the filters-object form to satisfy TypeScript overloads
      qc.invalidateQueries({ queryKey: ['course', courseId] });
      qc.invalidateQueries({ queryKey: ['courses'] });

      // Update the course-reactions cache if present
      qc.setQueryData<CourseReactionsCache | undefined>(['course-reactions', courseId], (old) => {
        if (!old) return old;
        const next: CourseReactionsCache = { ...old };

        if ('action' in variables && variables.action === 'remove') {
          next.userReaction = null;
          next.totalReactions = Math.max(0, (next.totalReactions ?? 0) - 1);
        } else {
          const type = (variables as any).type as ReactionType;
          const had = !!next.userReaction;
          next.userReaction = type;
          next.totalReactions = (next.totalReactions ?? 0) + (had ? 0 : 1);
        }

        return next;
      });

      // Update the main course cache (if SSR/parent used it)
      qc.setQueryData<any>(['course', courseId], (old: any) => {
        if (!old) return old;
        const next = { ...old };

        if (!next.reactions) next.reactions = { like: 0, love: 0, wow: 0, total: 0 };

        if ('action' in variables && variables.action === 'remove') {
          if (typeof next.reactions.total === 'number' && next.reactions.total > 0) {
            next.reactions.total = Math.max(0, next.reactions.total - 1);
          }
          next.userReaction = null;
        } else {
          const type = (variables as any).type as ReactionType;
          const had = !!next.userReaction;

          if (!had && typeof next.reactions.total === 'number') {
            next.reactions.total = (next.reactions.total || 0) + 1;
          }
          next.userReaction = type;
          // per-type counters left unchanged to avoid incorrect transitions unless you track previous type
        }

        return next;
      });
    },
    onError: (err) => {
      console.error('Reaction mutation failed', err);
    },
  });
}
