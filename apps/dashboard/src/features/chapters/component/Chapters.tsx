import { PlusCircle, Trash2, ChevronDown, ChevronUp, Book, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  IChapterResponse,
  IChapterSaveRequest,
  IChapterSaveResponse,
  ICourseDeleteResponse,
  IErrorResponse,
  ILecture,
  ILectureSaveRequest,
  ILectureSaveResponse,
} from '@elearning/types';
import { useMutation } from '@tanstack/react-query';
import chapterServices from '../services';
import queryClient from '@/lib/query-client';
import { useState } from 'react';
import EditChapter from './EditChapter';
import EditLecture from './EditLecture';

interface ChaptersProps {
  chapters: IChapterResponse[];
  courseId: string;
}

export default function Chapters({ courseId, chapters }: ChaptersProps) {
  const [selectedChapter, setSelectedChapter] = useState<IChapterResponse | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<ILecture | null>(null);
  const [openChapters, setOpenChapters] = useState<string[]>([]);

  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingLectureId, setDeletingLectureId] = useState<string | null>(null);

  // Create chapter
  const { mutate: addChapterMutation, isPending: addChapterLoading } = useMutation<
    IChapterSaveResponse,
    IErrorResponse,
    IChapterSaveRequest
  >({
    mutationFn: chapterServices.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
  });

  // Add lecture
  const { mutate: addLectureMutation, isPending: addLectureLoading } = useMutation<
    ILectureSaveResponse,
    IErrorResponse,
    { chapterId: string; inputs: ILectureSaveRequest }
  >({
    mutationFn: ({ chapterId, inputs }) => chapterServices.addLecture(chapterId, inputs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
  });

  // Delete chapter (we will call mutateAsync on this)
  const { mutateAsync: deleteChapterMutationAsync, isPending: deleteChapterLoading } = useMutation<
    ICourseDeleteResponse,
    IErrorResponse,
    string
  >({
    mutationFn: chapterServices.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['course', courseId],
      });
    },
    onMutate: (id) => {
      setDeletingChapterId(id);
    },
    onSettled: () => {
      setDeletingChapterId(null);
    },
  });

  // Delete lecture (we will call mutateAsync for each lecture)
  const { mutateAsync: deleteLectureMutationAsync, isPending: deleteLectureLoading } = useMutation<
    ICourseDeleteResponse,
    IErrorResponse,
    { id: string; lectureId: string }
  >({
    mutationFn: (inputs) => chapterServices.removeLecture(inputs.id, inputs.lectureId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['course', courseId],
      });
    },
    onMutate: (inputs) => {
      setDeletingLectureId(inputs.lectureId);
    },
    onSettled: () => {
      setDeletingLectureId(null);
    },
  });

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const addChapter = () => {
    addChapterMutation({ courseId, title: `Chapter ${chapters.length + 1}` });
  };

  const addLecture = (chapterId: string) => {
    const chapter = chapters.find((c) => c._id === chapterId);
    if (!chapter) return;
    addLectureMutation({
      chapterId,
      inputs: { title: `Lecture ${chapter?.lectures.length + 1}` },
    });
  };

  // Delete a chapter and its lectures:
  // - confirm
  // - attempt to delete all lectures (parallel via Promise.allSettled)
  // - then delete the chapter record
  const deleteChapter = async (id: string) => {
    const confirmed = window.confirm('Delete this chapter and all its lectures? This cannot be undone.');
    if (!confirmed) return;

    const chapter = chapters.find((c) => c._id === id);
    if (!chapter) {
      alert('Chapter not found.');
      return;
    }

    try {
      setDeletingChapterId(id);

      // If there are lectures, delete them first
      const lectureIds = (chapter.lectures || []).map((l) => String(l._id));
      if (lectureIds.length) {
        // delete all lectures in parallel but use allSettled to collect failures
        const lectureDeletes = await Promise.allSettled(
          lectureIds.map((lectureId) => deleteLectureMutationAsync({ id: chapter._id, lectureId }))
        );

        const failed = lectureDeletes
          .map((r, idx) => ({ r, lectureId: lectureIds[idx] }))
          .filter((x) => x.r.status === 'rejected');

        if (failed.length) {
          console.warn('Some lecture deletions failed for chapter', id, failed);
          // Inform admin but continue to attempt chapter deletion
          alert(
            `Warning: ${failed.length} lecture deletion(s) failed. Chapter deletion will still be attempted. Check console for details.`
          );
        }
      }

      // Now delete the chapter record itself
      await deleteChapterMutationAsync(id);

      // success feedback is handled by onSuccess invalidation — but give user a quick notice
      // (onSuccess already invalidates queries)
      // Optionally clear selection if it was the selected chapter
      if (selectedChapter?._id === id) {
        setSelectedChapter(null);
        setSelectedLecture(null);
      }
    } catch (err: any) {
      console.error('Error deleting chapter and its lectures', err);
      alert(`Delete failed: ${String(err?.message || err)}`);
    } finally {
      setDeletingChapterId(null);
    }
  };

  const deleteLecture = async (id: string, lectureId: string) => {
    const confirmed = window.confirm('Delete this lecture? This cannot be undone.');
    if (!confirmed) return;

    try {
      await deleteLectureMutationAsync({ id, lectureId });
      // if the deleted lecture was selected, clear selection
      if (selectedLecture?._id === lectureId) {
        setSelectedLecture(null);
      }
    } catch (err: any) {
      console.error('Delete lecture failed', err);
      alert(`Delete failed: ${String(err?.message || err)}`);
    }
  };

  return (
    <div
      // Prevent any form submission from this component
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Course Structure</span>
              <Button type="button" onClick={addChapter} size="sm" loading={addChapterLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[calc(100vh-300px)] overflow-auto">
              {chapters.map((chapter, index) => (
                <div key={chapter._id ?? index}>
                  <Collapsible
                    open={openChapters.includes(chapter._id)}
                    onOpenChange={() => toggleChapter(chapter._id)}
                    className="mb-2"
                  >
                    <div className="flex items-center space-x-2 bg-secondary p-2 rounded-md">
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="p-0">
                          {openChapters.includes(chapter._id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChapter(chapter);
                          setSelectedLecture(null);
                        }}
                        className="flex-grow text-left hover:text-primary"
                      >
                        <Book className="h-4 w-4 inline mr-2" />
                        {chapter.title}
                      </button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteChapter(chapter._id)}
                        loading={deleteChapterLoading && deletingChapterId === chapter._id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <CollapsibleContent>
                      <ul className="ml-6 mt-1 space-y-1">
                        {chapter.lectures.map((lecture, lindex) => (
                          <li key={String(lecture._id ?? lindex)} className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChapter(chapter);
                                setSelectedLecture(lecture);
                              }}
                              className="flex-grow text-left text-sm hover:text-primary"
                            >
                              <FileText className="h-3 w-3 inline mr-2" />
                              {lecture.title}
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteLecture(chapter._id, lecture._id.toString())}
                              loading={deleteLectureLoading && deletingLectureId === lecture._id.toString()}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>

                      <Button type="button" variant="outline" size="sm" className="ml-6 mt-1" onClick={() => addLecture(chapter._id)} loading={addLectureLoading}>
                        <PlusCircle className="mr-2 h-3 w-3" /> Add Lecture
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Content Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-300px)]">
              {selectedChapter !== null && (
                <div className="space-y-4">
                  {!selectedLecture && <EditChapter chapter={selectedChapter} />}
                  {selectedLecture !== null && <EditLecture courseId={courseId} chapter={selectedChapter} lecture={selectedLecture} />}
                </div>
              )}
              {selectedChapter === null && <div className="text-center text-gray-500">Select a chapter or lecture to edit</div>}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
