/* 'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Plus, Trash, Video, X } from 'lucide-react';
import {
  ILectureDeleteResponse,
  ILectureSaveRequest,
  ILectureSaveResponse,
  IErrorResponse,
  ILecture,
} from '@elearning/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LectureSaveSchema } from '@elearning/schemas';
import courseServices from '../services';
import queryClient from '@/lib/query-client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import VideoUploader from '@/features/upload/components/VideoUploader';
import VideoPreview from './VideoPreview';
import { useDialog } from '@/hooks/use-dialog';

interface LecturesFormProps {
  lectures: ILecture[];
  courseId: string;
}

const LecturesForm = ({ lectures, courseId }: LecturesFormProps) => {
  const [currentLecture, setCurrentLecture] = useState<ILecture | null>(null);
  const [open, setOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Record<string, boolean>>({});
  const dialog = useDialog();

  const { mutateAsync } = useMutation<ILectureDeleteResponse, IErrorResponse, string>({
    mutationFn: (lectureId) => courseServices.removeLecture(courseId, lectureId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['course', courseId],
      });
    },
  });

  const { mutate, isPending } = useMutation<ILectureSaveResponse, IErrorResponse, ILectureSaveRequest>({
    mutationFn: (data) =>
      currentLecture
        ? courseServices.updateLecture(courseId, currentLecture._id.toString(), data)
        : courseServices.addLecture(courseId, data),
    onSuccess: (data) => {
      if (data.lecture && !currentLecture) {
        setCurrentLecture(data.lecture);
      } else {
        form.reset();
        setCurrentLecture(null);
        setOpen(false);
      }
      queryClient.invalidateQueries({
        queryKey: ['course', courseId],
      });
    },
  });

  const form = useForm<ILectureSaveRequest>({
    resolver: zodResolver(LectureSaveSchema),
    defaultValues: {
      title: currentLecture?.title || '',
    },
  });

  const onSubmit = (values: ILectureSaveRequest) => {
    mutate(values);
  };

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = form;

  const toggleEditVideo = (lectureId: string) => {
    setEditingVideo((prev) => ({
      ...prev,
      [lectureId]: !prev[lectureId],
    }));
  };

  const deleteHandler = (id: string) => {
    dialog.show({
      title: 'Confirm Deletion',
      description: `Are you sure you want to delete it?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await mutateAsync(id);
      },
    });
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Lectures</CardTitle>
        <CardDescription>Manage the lectures for your course.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[500px] pr-4">
          <Accordion type="single" collapsible className="w-full space-y-4" onValueChange={() => {}}>
            {lectures.map((lecture, index) => (
              <AccordionItem
                value={`item-${index}`}
                key={lecture._id.toString()}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline px-4 py-2 bg-gray-50">
                  <div className="flex justify-between items-center w-full">
                    <span className="font-medium">{lecture.title}</span>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          form.reset();
                          form.setValue('title', lecture.title);
                          setCurrentLecture(lecture);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHandler(lecture._id.toString());
                        }}
                      >
                        <Trash className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-2">
                  {lecture.playbackId && !currentLecture && !editingVideo[lecture._id.toString()] ? (
                    <div className="space-y-2">
                      <div className="w-full">
                        <VideoPreview playbackId={lecture.playbackId} />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleEditVideo(lecture._id.toString())}
                        className="w-full"
                      >
                        <Video className="h-4 w-4 mr-2" /> Edit Video
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <VideoUploader
                        courseId={courseId}
                        lectureId={lecture._id.toString()}
                        onUploadSuccess={() => {
                          toggleEditVideo(lecture._id.toString());
                          queryClient.invalidateQueries({
                            queryKey: ['course', courseId],
                          });
                        }}
                      />
                      {lecture.playbackId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleEditVideo(lecture._id.toString())}
                          className="w-full"
                        >
                          <X className="h-4 w-4 mr-2" /> Cancel Edit
                        </Button>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
        <Button
          className="w-full mt-6"
          onClick={() => {
            setCurrentLecture(null);
            form.reset();
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Lecture
        </Button>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentLecture ? 'Edit Lecture' : 'Add New Lecture'}</DialogTitle>
              <DialogDescription>
                {currentLecture ? 'Edit the details for the lecture' : 'Enter the details for the new lecture'}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Input id="title" placeholder="Lecture Title" {...register('title')} error={errors.title?.message} />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {currentLecture ? 'Update' : 'Add'} Lecture
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default LecturesForm;
 */