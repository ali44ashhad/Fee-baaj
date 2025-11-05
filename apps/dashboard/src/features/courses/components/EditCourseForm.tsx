// src/features/courses/components/EditCourseForm.tsx
import React, { useState } from 'react';
import { Plus, X, UploadCloud, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Added useQueryClient for potential refetch
import type {
  ICategoryResponse,
  ICourseResponse,
  ICourseSaveRequest,
  ICourseSaveResponse,
  IErrorResponse,
  IInstructorResponse,
} from '@elearning/types';
import courseServices from '../services';
import { CourseSaveSchema } from '@elearning/schemas';
import { SearchableSelect } from './SearchableSelect';
import ImageUploader from '../upload/components/ImageUploader';
import Chapters from '@/features/chapters/component/Chapters';
import YoutubePreview from './YoutubePreview';
import VideoPopupManager from './EditPopups';
import VideoUpload from './VideoUpload';
import CourseEditStatus from './CourseEditStatus'; // status panel we added
import ProgressBar from '@/components/ui/ProgressBar';

// Upload helpers
import { uploadSmallFile, uploadLargeFileMultipart } from '../uploadService';

type VideoPopup = {
  link: string;
  popupDuration: number;
  triggerAt: number;
};

interface EditCourseFormProps {
  course: ICourseResponse;
  categories: ICategoryResponse[];
  instructors: IInstructorResponse[];
}

export default function EditCourseForm({ categories, instructors, course }: EditCourseFormProps) {
  const queryClient = useQueryClient(); // Initialize query client

  // send JSON payload to update metadata (no FormData)
  const { mutateAsync, isPending: isSaving } = useMutation<ICourseSaveResponse, IErrorResponse, any>({
    mutationFn: (payload) => courseServices.updateMeta(course.id, payload),
  });

  // local upload state
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  // NEW STATE for thumbnail upload
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState<number>(0);

  const form = useForm<ICourseSaveRequest>({
    resolver: zodResolver(CourseSaveSchema),
    defaultValues: {
      title: course.title || '',
      slug: course.slug || '',
      subtitle: course.subtitle || '',
      description: course.description || '',
      price: course.price || 0,
      originalPrice: course.originalPrice || 0,
      categoryId: course.categoryId?.toString() || '',
      instructorId: course.instructorId?.toString() || '',
      objectives: course.objectives || [''],
      requirements: course.requirements || [''],
      // RHF value for thumbnail can be string (URL/ID) or File object
      thumbnail: (course.thumbnailUrl as any) || null,
      video: (course.bunnyVideoId || course.video || '') as any,
      bestSeller: course.bestSeller || false,
      premium: course.premium || false,
      published: course.published || false,
      display: {
        ...course.display,
        watchingNow: {
          min: Number(course.display?.watchingNow?.min || 0),
          max: Number(course.display?.watchingNow?.max || 0),
        },
      },
      videoPopups: (course.videoPopups || []) as VideoPopup[],
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
    watch,
  } = form;

  const {
    fields: objectiveFields,
    append: appendObjective,
    remove: removeObjective,
  } = useFieldArray({ control, name: 'objectives' });

  const {
    fields: requirementFields,
    append: appendRequirement,
    remove: removeRequirement,
  } = useFieldArray({ control, name: 'requirements' });

  // WATCH the reactive videoPopups array so UI reflects form state
  const watchedVideoPopups = watch('videoPopups') as VideoPopup[] | undefined;
  // WATCH the thumbnail value for display (can be string URL or File object)
  const watchedThumbnail = watch('thumbnail');
  
  // LOGIC TO DISPLAY THE THUMBNAIL:
  // 1. New file selected in local state (highest priority)
  // 2. RHF value is a string (new URL after successful save or existing URL from fetch)
  // 3. Fallback to original course URL (lowest priority, only if RHF value is null/undefined)
  const thumbnailURL = selectedThumbnail 
  ? URL.createObjectURL(selectedThumbnail) 
  : (typeof watchedThumbnail === 'string' 
      ? watchedThumbnail 
      : null // <--- NOW IT'S NULL IF NOT A NEW FILE OR A VALID RHF URL
    );

  // Called by VideoPopupManager when it wants to replace the whole list (edit/remove)
  const handleVideoPopupsUpdate = (updatedPopups: VideoPopup[]) => {
    setValue('videoPopups', updatedPopups || [], { shouldDirty: true });
  };

  // Called by VideoUpload when user "adds" a popup while editing (same signature as CreateCourse)
  const handlePopupAdd = (link: string, popupDuration: number, triggerAt: number) => {
    const current = (getValues('videoPopups') as VideoPopup[]) || [];
    const newPopup: VideoPopup = { link, popupDuration, triggerAt };
    const updated = [...current, newPopup];
    setValue('videoPopups', updated, { shouldDirty: true });
  };

  // update RHF state + local selected file refs for Video
  const handleVideoFileSelect = (file: File | null) => {
    if (!file) return;
    setSelectedVideoFile(file);
    setValue('video', file as any, { shouldDirty: true });
  };

  // update RHF state + local selected file refs for Thumbnail
  const handleThumbnailSelect = (file: File | null) => {
    if (!file) return;
    setSelectedThumbnail(file);
    // Setting RHF value to File object
    setValue('thumbnail', file as any, { shouldDirty: true });
  };
  
  // Logic for the new Delete button
  const handleDeleteThumbnail = async () => {
    console.log(`Attempting to delete thumbnail for course ID: ${course.id}`);
    
    // Clear local state and RHF value immediately for visual feedback
    setSelectedThumbnail(null);
    setValue('thumbnail', null as any, { shouldDirty: true });

    // Assuming a service function exists to delete the thumbnail on the backend
    try {
      // Assuming this service function returns the updated course object or a success status
      await courseServices.deleteCourseThumbnail(String(course.id));
 
      
      // Since the backend deletes it, the RHF value is already set to null above.
      // If the backend returns the course, you could use its thumbnailUrl (which should be null) to re-set RHF.
      // queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      
    } catch (err) {
      console.error('Thumbnail deletion failed', err);
      // OPTIONAL: Handle error by showing a toast or reverting local state
    }
  };

  const THRESH = Number(import.meta.env.VITE_DIRECT_UPLOAD_THRESHOLD || 209715200); // default 200MB unless overridden

  const onSubmit = handleSubmit(async (values: ICourseSaveRequest) => {
    let newThumbnailUrl = ''; // Initialize a variable to hold the new URL

    try {
      // Reset progress bars
      setVideoProgress(0);
      setThumbnailProgress(0);

      // Build JSON payload (no files)
      const payload: any = {
        title: values.title,
        slug: values.slug || '',
        subtitle: values.subtitle || '',
        description: values.description || '',
        price: values.price,
        originalPrice: values.originalPrice || 0,
        categoryId: values.categoryId || '',
        instructorId: values.instructorId || '',
        objectives: values.objectives || [],
        requirements: values.requirements || [],
        bestSeller: values.bestSeller || false,
        premium: values.premium || false,
        published: values.published || false,
        display: values.display || {},
        videoPopups: values.videoPopups || [],
      };

      // 1) Update metadata (JSON) - This might be where the old image URL is being re-fetched/re-used if the upload hasn't happened yet.
      // However, since the thumbnail field is part of `values` but excluded from `payload`, the old URL is only an issue
      // in the frontend display fallback. The server should maintain the *current* URL.
      const res = await mutateAsync(payload);


      // Ensure courseId is string
      const courseId = String(course.id);

      // 2) If thumbnail selected, upload it (small upload)
      if (selectedThumbnail) {
        setIsUploadingThumbnail(true); // Use new state
        try {
          // Assuming uploadCourseThumbnail returns the new image URL
          const uploadRes = await courseServices.uploadCourseThumbnail(selectedThumbnail, String(courseId), (pct) => {
            setThumbnailProgress(pct); // Use new state
          });

          // ***************************************************************
          // 🚨 CRITICAL FIX 1: Capture the new URL from the upload response
          // ***************************************************************
          newThumbnailUrl = uploadRes.url; // Assuming your upload response has a 'url' field

          setSelectedThumbnail(null); // Clear local file ref after successful upload
        } catch (err) {
          console.error('Thumbnail upload failed', err);
        } finally {
          setThumbnailProgress(0);
          setIsUploadingThumbnail(false); // Use new state
        }
      }

      // *****************************************************************
      // 🚨 CRITICAL FIX 2: Update RHF value with the new URL *after* the upload.
      // This immediately changes `watchedThumbnail` to the new string URL,
      // overriding the old string URL or the temporary File object.
      // Only do this if a new URL was obtained from the upload or if the thumbnail was deleted.
      // If the user didn't touch the thumbnail, `newThumbnailUrl` is empty,
      // and we shouldn't change the RHF value from its current string (the existing URL).
      // *****************************************************************
      if (newThumbnailUrl) {
          setValue('thumbnail', newThumbnailUrl, { shouldDirty: false, shouldValidate: false });
          // Note: If you were using queryClient.invalidateQueries, a full refetch would handle this RHF update, 
          // but this immediate setValue is faster for UX.
      } else if (values.thumbnail === null) {
          // This handles the delete case: ensure RHF value remains null
          setValue('thumbnail', null as any, { shouldDirty: false, shouldValidate: false });
      }


      // 3) If video selected and it's a File, upload (small or multipart)
      const maybeVideo = values.video as any;
      const fileToUpload = selectedVideoFile ?? (maybeVideo instanceof File ? maybeVideo : null);
      
      if (fileToUpload instanceof File) {
        try {
          setIsUploadingVideo(true); // Use new state
          // Choose direct or multipart based on THRESH
          if (fileToUpload.size <= THRESH) {
            await uploadSmallFile(fileToUpload, { courseId, isIntro: true }, (pct) => setVideoProgress(pct)); // Use new state
          } else {
            await uploadLargeFileMultipart(fileToUpload, { courseId, isIntro: true }, (pct) => setVideoProgress(pct)); // Use new state
          }
          setSelectedVideoFile(null); // Clear local file ref after successful upload
        } catch (err) {
          console.error('Video upload failed', err);
        } finally {
          setVideoProgress(0);
          setIsUploadingVideo(false); // Use new state
        }
      }

      // 4) Done — keep form state; you can notify user or refresh data
      console.log('Course update (meta + optional uploads) finished');
      
      // OPTIONAL: Invalidate relevant queries after a full save/upload
      // queryClient.invalidateQueries({ queryKey: ['course', course.id] });
    } catch (err) {
      console.error('Failed to update course:', err);
      throw err;
    }
  });
  
  // State to control the ImageUploader visibility
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* ... Course Details Card ... */}
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
              <CardDescription>Provide the main information about your course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input id="title" {...register('title')} label="Title" error={errors.title?.message} />
              </div>

              <div className="space-y-2">
                <Input id="subtitle" {...register('subtitle')} label="Subtitle" error={errors.subtitle?.message} />
              </div>

              <div className="space-y-2">
                <Input id="slug" {...register('slug')} label="Slug" error={errors.slug?.message} />
              </div>

              <div className="space-y-2">
                <Textarea
                  id="description"
                  {...register('description')}
                  label="Description"
                  error={errors.description?.message}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Input
                    id="price"
                    type="number"
                    {...register('price', { valueAsNumber: true })}
                    label="Price"
                    error={errors.price?.message}
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    id="originalPrice"
                    type="number"
                    {...register('originalPrice', { valueAsNumber: true })}
                    label="Original price"
                    error={errors.originalPrice?.message}
                  />
                </div>

                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={categories.map((c) => ({ value: c._id.toString(), label: c.name }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select category"
                      label="Category"
                      id="categoryId"
                      error={errors.categoryId?.message}
                    />
                  )}
                />

                <Controller
                  name="instructorId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={instructors.map((c) => ({ value: c._id.toString(), label: c.name }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select instructor"
                      label="Instructor"
                      id="instructorId"
                      error={errors.instructorId?.message}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* --- Course Content Card --- 
          */}
          <Card>
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>Add objectives and requirements for your course.</CardDescription>
            </CardHeader>
            <CardContent className="space-x-10 flex justify-between">
              <div className="space-y-2 w-1/2">
                <Label className="block">Objectives</Label>
                {objectiveFields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-2 w-full">
                    <div className="flex-grow">
                      <Input {...register(`objectives.${index}`)} />
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeObjective(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => appendObjective('')}>
                  <Plus className="h-4 w-4 mr-2" /> Add Objective
                </Button>
              </div>

              <div className="space-y-2 w-1/2">
                <Label className="block">Requirements</Label>
                {requirementFields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <div className="flex-grow">
                      <Input {...register(`requirements.${index}`)} />
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRequirement(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => appendRequirement('')}>
                  <Plus className="h-4 w-4 mr-2" /> Add Requirement
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* --- Video Popups Card --- 
          */}
          <Card>
            <CardHeader>
              <CardTitle>Video Popups</CardTitle>
            </CardHeader>
            <CardContent>
              {/* IMPORTANT: pass the reactive watch value so manager always shows current form state */}
              <VideoPopupManager
                videoLength={Number(course.videoLength) || 0}
                videoPopups={watchedVideoPopups || []}
                onUpdate={handleVideoPopupsUpdate}
              />
            </CardContent>
          </Card>

          {/* --- Display Content Card --- 
          */}
          <Card>
            <CardHeader>
              <CardTitle>Display Content</CardTitle>
              <CardDescription>Add display numbers for your course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Input
                    id="display.watchingNow.min"
                    type="number"
                    {...register('display.watchingNow.min', { valueAsNumber: true })}
                    label="Watching now - MIN"
                    error={errors.display?.watchingNow?.min?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                
                    id="display.watchingNow.max"
                    type="number"
                    {...register('display.watchingNow.max', { valueAsNumber: true })}
                    label="Watching now - MAX"
                    error={errors.display?.watchingNow?.max?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.students"
                    {...register('display.students')}
                    label="Students"
                    error={errors.display?.students?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                     type="number"
                    id="display.views"
                    {...register('display.views')}
                    label="Views"
                    error={errors.display?.views?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                     type="number"
                    id="display.reviews"
                    {...register('display.reviews')}
                    label="Reviews"
                    error={errors.display?.reviews?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                     type="number"
                    id="display.rating"
                    {...register('display.rating')}
                    label="Rating"
                    error={errors.display?.rating?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="number"
                    id="display.likes"
                    {...register('display.likes')}
                    label="Likes"
                    error={errors.display?.likes?.message}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          
          {/* --- Course Thumbnail Card --- 
          */}
          <Card>
            <CardHeader>
              <CardTitle>Course Thumbnail</CardTitle>
              <CardDescription>Your current and updated course thumbnail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display Thumbnail */}
              <div className="w-full h-40 border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                {thumbnailURL ? (
                  <img 
                    className="h-full w-full object-cover" 
                    src={thumbnailURL || "/userPlaceHolder.jpg"} 
                    alt="Current Course Thumbnail" 
                  />
                ) : (
                  <span className="text-gray-500">No thumbnail set.</span>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-2/3 text-sm"
                  onClick={() => setIsUploaderOpen(true)}
                  disabled={isUploadingThumbnail}
                >
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Update 
                </Button>

                <Button 
                  type="button" 
                  variant="destructive" 
                  className="w-1/3 text-sm "
                  onClick={handleDeleteThumbnail}
                  // Disable if no thumbnail URL is set (can be string or a newly selected file) or if currently uploading
                  disabled={!thumbnailURL && !selectedThumbnail || isUploadingThumbnail} 
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                
                </Button>
              </div>

              {/* Image Uploader (hidden until Update is clicked) */}
              {isUploaderOpen && (
                <div className="pt-4 border-t mt-4">
                  <h4 className="text-sm font-medium mb-2">Select new image</h4>
                  <ImageUploader
                    onFileSelect={(file: File) => {
                      handleThumbnailSelect(file);
                      setIsUploaderOpen(false); // Close uploader on selection
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsUploaderOpen(false)} className="mt-2 text-xs">
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              )}

              {/* Progress Bar for Thumbnail Upload */}
              {isUploadingThumbnail && (
                <div className="mt-3">
                  <ProgressBar 
                    value={thumbnailProgress} 
                    showPercent 
                    label="Uploading Thumbnail" 
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* --- Video Upload Card --- 
          */}
          <Card>
            <CardHeader>
              <CardTitle>Edit & update Video</CardTitle>
            </CardHeader>
            <CardContent>
              {/* pass popup adder that appends to the form list */}
              <VideoUpload onAddPopup={handlePopupAdd} onFileSelect={handleVideoFileSelect} />

              {/* Progress Bar for Video Upload */}
              {isUploadingVideo && (
                <div className="mt-3">
                  <ProgressBar 
                    value={videoProgress} 
                    showPercent 
                    label="Uploading Video" 
                  />
                </div>
              )}
              
              {watch('video') && <YoutubePreview videoUrl={String(getValues('video') || '')} />}
              {/* Insert status panel (polls /shows playback link) */}
              <div className="mt-4">
                <CourseEditStatus courseId={course.id} type="intro" />
              </div>
            </CardContent>
          </Card>

          {/* --- Course Settings Card --- 
          */}
          <Card>
            <CardHeader>
              <CardTitle>Course Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                name="bestSeller"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Switch id="bestSeller" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="bestSeller">Best Seller</Label>
                  </div>
                )}
              />

              <Controller
                name="premium"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Switch id="premium" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="premium">Premium</Label>
                  </div>
                )}
              />

              <Controller
                name="published"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Switch id="published" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="published">Published</Label>
                  </div>
                )}
              />

              <div>
                {/* Show general saving/uploading status */}
                {(isSaving || isUploadingThumbnail || isUploadingVideo) && (
                  <div className="mb-2 text-sm text-gray-500">
                    {isSaving && 'Saving metadata... '}
                    {isUploadingThumbnail && `Uploading Thumbnail: ${Math.round(thumbnailProgress)}% `}
                    {isUploadingVideo && `Uploading Video: ${Math.round(videoProgress)}%`}
                  </div>
                )}
                <Button 
                  className="w-full" 
                  type="submit" 
                  disabled={isSaving || isUploadingThumbnail || isUploadingVideo}
                >
                  {isSaving ? 'Saving...' : (isUploadingThumbnail || isUploadingVideo ? 'Uploading...' : 'Save Course')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Chapters courseId={course.id} chapters={course.chapters} />
    </form>
  );
}