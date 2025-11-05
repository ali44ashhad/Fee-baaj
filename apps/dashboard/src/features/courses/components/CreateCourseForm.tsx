import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  ICategoryResponse,
  ICourseSaveRequest,
  ICourseSaveResponse,
  IErrorResponse,
  IInstructorResponse,
} from '@elearning/types';
import courseServices from '../services';
import { CourseSaveSchema } from '@elearning/schemas';
import { SearchableSelect } from './SearchableSelect';
import { useNavigate } from 'react-router-dom';
import webRoutes from '@/lib/webRoutes';
import VideoUpload from './VideoUpload';
import ImageUploader from '../upload/components/ImageUploader';
import ProgressBar from '@/components/ui/ProgressBar';
// Changed to not use default export due to your provided component structure, 
// but keeping the path for reference.


// Upload helpers (adjust path if you put uploadService elsewhere)
import { uploadSmallFile, signMultipart, signPart, completeMultipart } from '../uploadService';
// NOTE: I've removed `uploadLargeFileMultipart` from the imports here as you redefined it below.

interface CreateCourseFormProps {
  categories: ICategoryResponse[];
  instructors: IInstructorResponse[];
}

type VideoPopup = {
  link: string;
  popupDuration: number;
  triggerAt: number;
};

export const MEDIA_BASE = import.meta.env.VITE_MEDIA_API_URL;

export default function CreateCourseForm({ categories, instructors }: CreateCourseFormProps) {
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [videoPopups, setVideoPopups] = useState<VideoPopup[]>([]);
  // 1. Differentiate upload states
  const [thumbnailProgress, setThumbnailProgress] = useState<number>(0);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentUploadType, setCurrentUploadType] = useState<'thumbnail' | 'video' | null>(null);

  const navigate = useNavigate();

  const { mutateAsync: createMeta, isPending: creatingMeta } = useMutation<
    ICourseSaveResponse,
    IErrorResponse,
    any
  >({
    mutationFn: courseServices.createMeta,
  });

  const form = useForm<ICourseSaveRequest>({
    resolver: zodResolver(CourseSaveSchema),
    defaultValues: {
      title: '',
      subtitle: '',
      description: '',
      price: 0,
      originalPrice: 0,
      categoryId: '',
      instructorId: '',
      objectives: [''],
      requirements: [''],
      video: null,
      thumbnail: null,
      bestSeller: false,
      premium: false,
      published: false,
      display: {
        likes: '0',
        views: '0',
        reviews: '0',
        rating: '0.0',
        students: '0',
        watchingNow: { min: 0, max: 0 },
      },
      videoPopups: [],
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
    control,
  } = form;

  const {
    fields: objectiveFields,
    append: appendObjective,
    remove: removeObjective,
  } = useFieldArray({
    control: form.control,
    name: 'objectives',
  });

  const {
    fields: requirementFields,
    append: appendRequirement,
    remove: removeRequirement,
  } = useFieldArray({
    control: form.control,
    name: 'requirements',
  });

  const handlePopupAdd = (link: string, popupDuration: number, triggerAt: number) => {
    const currentPopups = getValues('videoPopups');
    const newPopup: VideoPopup = { link, popupDuration, triggerAt };
    const updatedPopups = [...currentPopups, newPopup];
    setValue('videoPopups', updatedPopups as VideoPopup[]);
    setVideoPopups(updatedPopups as VideoPopup[]);
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    setSelectedVideoFile(file);
    setValue('video', file);
    setVideoProgress(0); // Reset progress on file selection
  };

  const handleThumbnailSelect = (file: File) => {
    setSelectedThumbnail(file);
    setValue('thumbnail', file);
    setThumbnailProgress(0); // Reset progress on file selection
  };

  // --- Helper: upload large file via signMultipart/signPart/completeMultipart
  // simple chunked uploader (10MB chunks). Uses signMultipart/signPart/completeMultipart api helpers.
  // inside CreateCourseForm.tsx (replace your existing uploadLargeFileMultipart)
  async function uploadLargeFileMultipart(
    file: File,
    courseId: string | any,
    opts?: { lectureId?: string; isIntro?: boolean },
  ) {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    const parts: { ETag: string; PartNumber: number }[] = [];

    // 1) Start multipart on media server
    const start = await signMultipart(file.name, file.type); // returns { key, uploadId }
    if (!start?.key || !start?.uploadId) throw new Error('Failed to start multipart upload');

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedBytes = 0;

    for (let part = 1; part <= totalParts; part++) {
      const startByte = (part - 1) * CHUNK_SIZE;
      const endByte = Math.min(part * CHUNK_SIZE, file.size);
      const chunk = file.slice(startByte, endByte);

      // get presigned URL for this part (server provides proxy info too)
      const signRes = await signPart({ key: start.key, uploadId: start.uploadId, partNumber: part });
      if (!signRes) throw new Error('Failed to sign part');

      const presignedUrl: string | undefined = signRes.url;
      const proxyOk: boolean = !!signRes.proxy;
      const proxyUrl: string | undefined = signRes.proxyUrl;

      let etag = '';

      // 2a) Try direct PUT to presigned URL first
      if (presignedUrl) {
        try {
          const putRes = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: chunk,
          });

          if (putRes.ok) {
            etag = (putRes.headers.get('ETag') || putRes.headers.get('etag') || '').replace(/"/g, '');
          } else {
            console.warn(`Direct PUT part ${part} failed status=${putRes.status}`);
          }
        } catch (err) {
          console.warn(`Direct PUT part ${part} threw, will try proxy`, err);
        }
      }

      // 2b) Fallback to proxy if direct PUT didn't produce an ETag
      if (!etag && proxyOk && proxyUrl) {
        const fd = new FormData();
        fd.append('key', start.key);
        fd.append('uploadId', start.uploadId);
        fd.append('partNumber', String(part));
        // IMPORTANT: include a filename so formidable writes a proper file entry
        fd.append('part', chunk as Blob, `part-${part}.bin`);

        const proxyRes = await fetch(`${MEDIA_BASE}/api/upload/proxy-part`, {
          method: 'POST',
          body: fd,
        });

        let proxyJson: any = null;
        try {
          proxyJson = await proxyRes.json();
        } catch (e) {
          throw new Error(`Proxy upload for part ${part} failed to parse JSON: ${String(e)}`);
        }

        if (!proxyRes.ok || !proxyJson?.ok) {
          throw new Error(`Proxy upload failed for part ${part}: ${proxyRes.status} ${JSON.stringify(proxyJson)}`);
        }

        etag = (proxyJson.ETag || proxyJson?.etag || '').replace(/"/g, '');
      }

      if (!etag) {
        throw new Error(`Part ${part} failed (no ETag).`);
      }

      // store part
      parts.push({ ETag: etag, PartNumber: part });

      uploadedBytes += chunk.size;
      // 2. Update the dedicated video progress state
      setVideoProgress(Math.round((uploadedBytes / file.size) * 100));
    }

    // 3) Complete multipart — pass courseId, lectureId and isIntro as provided
    const completeRes = await completeMultipart({
      key: start.key,
      uploadId: start.uploadId,
      parts,
      courseId,
      filename: file.name,
      lectureId: opts?.lectureId,
      isIntro: typeof opts?.isIntro === 'boolean' ? opts?.isIntro : true, // default true for create-course
    });
    if (!completeRes?.ok) throw new Error('Failed to complete multipart upload');

    return completeRes;
  }

  const onSubmit = async (values: ICourseSaveRequest) => {
    try {
      // 1) create metadata record first (no files)
      const payload = {
        title: values.title,
        subtitle: values.subtitle,
        description: values.description,
        price: values.price,
        originalPrice: values.originalPrice,
        categoryId: values.categoryId,
        instructorId: values.instructorId,
        objectives: values.objectives,
        requirements: values.requirements,
        display: values.display,
        videoPopups: values.videoPopups,
        bestSeller: values.bestSeller,
        premium: values.premium,
        published: values.published,
      };

      const res = await createMeta(payload);
      const courseId = (res as any)._id || (res as any).id;
      if (!courseId) {
        return alert('Course creation failed: no id returned');
      }

      // 2) upload thumbnail (small) via courseServices.uploadThumbnail (new) if present
      if (selectedThumbnail) {
        setCurrentUploadType('thumbnail');
        setIsUploading(true);
        try {
          await courseServices.uploadCourseThumbnail(selectedThumbnail, String(courseId), (pct) => {
            setThumbnailProgress(pct); // Use dedicated thumbnail progress
          });
        } catch (err) {
          console.error('Thumbnail upload failed', err);
          // you might want to show user feedback
        } finally {
          setThumbnailProgress(0);
          setCurrentUploadType(null);
        }
      }

      // 3) upload video (small direct to media server or large via multipart)
      if (selectedVideoFile) {
        const THRESH = Number(import.meta.env.VITE_DIRECT_UPLOAD_THRESHOLD || 200 * 1024 * 1024);
        
        setCurrentUploadType('video');
        // NOTE: We keep isUploading true until all uploads (including thumbnail) are done.
        // It's set to true before the thumbnail upload, so we don't need to re-set it here, 
        // but it's important to set it true if the thumbnail was skipped.
        if (!isUploading) setIsUploading(true); 

        try {
            if (selectedVideoFile.size <= THRESH) {
              // small upload (include isIntro true)
              await uploadSmallFile(selectedVideoFile, { courseId, isIntro: true }, (pct) => {
                setVideoProgress(pct); // Use dedicated video progress
              });
            } else {
              // large upload: multipart (pass isIntro true)
              // The custom uploadLargeFileMultipart above already uses setVideoProgress
              await uploadLargeFileMultipart(selectedVideoFile, courseId, { isIntro: true });
            }
        } catch (err) {
            console.error('Video upload failed', err);
            // you might want to show user feedback
        } finally {
            setVideoProgress(0);
            setCurrentUploadType(null); // Clear type after completion
        }
      }

      // Final cleanup
      setIsUploading(false);
      // done
      navigate(webRoutes.courses);
    } catch (err) {
      console.error('CreateCourse error', err);
      setIsUploading(false);
      setThumbnailProgress(0);
      setVideoProgress(0);
      setCurrentUploadType(null);
      alert((err as Error).message || 'Upload failed');
    }
  };

  const currentOverallProgress = (
    (currentUploadType === 'thumbnail' ? thumbnailProgress : 0) + 
    (currentUploadType === 'video' ? videoProgress : 0)
  );


  // Render the progress bar only when uploading and show the relevant progress.
  const isOverallUploading = isUploading || creatingMeta;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
              <CardDescription>Provide the main information about your course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input id="title" label="Title" {...register('title')} error={errors.title?.message} />
              </div>
              <div className="space-y-2">
                <Input id="subtitle" label="Subtitle" {...register('subtitle')} error={errors.subtitle?.message} />
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
                    label="Price"
                    {...register('price', { valueAsNumber: true })}
                    error={errors.price?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="originalPrice"
                    type="number"
                    label="Original Price"
                    {...register('originalPrice', { valueAsNumber: true })}
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

          <Card>
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>Add objectives and requirements for your course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="block">Objectives</Label>
                {objectiveFields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-2">
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

              <div className="space-y-2">
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
                    label="Watching Now (Min)"
                    {...register('display.watchingNow.min', { valueAsNumber: true })}
                    error={errors.display?.watchingNow?.min?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.watchingNow.max"
                    type="number"
                    label="Watching Now (Max)"
                    {...register('display.watchingNow.max', { valueAsNumber: true })}
                    error={errors.display?.watchingNow?.max?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.students"
                    type="number"
                    label="Students"
                    {...register('display.students')}
                    error={errors.display?.students?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.views"
                    type="number"
                    label="Views"
                    {...register('display.views')}
                    error={errors.display?.views?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.reviews"
                    type="number"
                    label="Reviews"
                    {...register('display.reviews')}
                    error={errors.display?.reviews?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.rating"
                    type="number"
                    label="Rating"
                    {...register('display.rating')}
                    error={errors.display?.rating?.message}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="display.likes"
                    type="number"
                    label="Likes"
                    {...register('display.likes')}
                    error={errors.display?.likes?.message}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Course Thumbnail</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploader
                onFileSelect={(file: File) => {
                  setValue('thumbnail', file);
                  handleThumbnailSelect(file);
                }}
              />
              {/* 3. Display thumbnail progress if selected and currently uploading it */}
              {isUploading && currentUploadType === 'thumbnail' && (
                <div className="mt-3">
                  <ProgressBar value={thumbnailProgress} showPercent label="Uploading Thumbnail" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Course Intro Video</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoUpload onAddPopup={handlePopupAdd} onFileSelect={handleFileSelect} />
              {/* 4. Display video progress if selected and currently uploading it */}
              {isUploading && currentUploadType === 'video' && (
                <div className="mt-3">
                  <ProgressBar value={videoProgress} showPercent label="Uploading Intro Video" />
                </div>
              )}

              {videoPopups.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-gray-800 mb-2">Popups:</h3>
                  <ol>
                    {videoPopups.map((popup, index) => (
                      <li key={index} className="text-gray-700">
                        {Math.floor(popup.triggerAt / 60)}m {popup.triggerAt % 60}s -{' '}
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-800 underline-offset-1"
                          href={popup.link}
                        >
                          Link
                        </a>{' '}
                        Duration: {popup.popupDuration}s
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

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
                {isOverallUploading && <div className="mb-2">
                    {creatingMeta ? 'Creating Course Metadata...' : `Uploading ${currentUploadType}...`}
                </div>}
                <Button className="w-full" type="submit" disabled={isOverallUploading}>
                  {creatingMeta ? 'Saving Metadata...' : isUploading ? 'Uploading Files...' : 'Save Course'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}