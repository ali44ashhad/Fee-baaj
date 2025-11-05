import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PlusCircle, Trash2, ChevronDown, ChevronUp, Book, FileText, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';

interface Lecture {
  id: number;
  title: string;
  content: string;
}

interface Chapter {
  id: number;
  title: string;
  lectures: Lecture[];
  isOpen: boolean;
}

export default function NewCoursePage() {
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<number | null>(null);

  const addChapter = () => {
    const newChapter = { id: Date.now(), title: `Chapter ${chapters.length + 1}`, lectures: [], isOpen: true };
    setChapters([...chapters, newChapter]);
    setSelectedChapter(newChapter.id);
    setSelectedLecture(null);
    toast({
      title: 'Chapter added',
      description: `${newChapter.title} has been added to the course.`,
    });
  };

  const addLecture = (chapterId: number) => {
    setChapters(
      chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lectures: [
                ...chapter.lectures,
                { id: Date.now(), title: `Lecture ${chapter.lectures.length + 1}`, content: '' },
              ],
            }
          : chapter,
      ),
    );
    toast({
      title: 'Lecture added',
      description: 'A new lecture has been added to the chapter.',
    });
  };

  const updateChapter = (chapterId: number, title: string) => {
    setChapters(chapters.map((chapter) => (chapter.id === chapterId ? { ...chapter, title } : chapter)));
  };

  const updateLecture = (chapterId: number, lectureId: number, title: string, content: string) => {
    setChapters(
      chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lectures: chapter.lectures.map((lecture) =>
                lecture.id === lectureId ? { ...lecture, title, content } : lecture,
              ),
            }
          : chapter,
      ),
    );
  };

  const deleteChapter = (chapterId: number) => {
    setChapters(chapters.filter((chapter) => chapter.id !== chapterId));
    if (selectedChapter === chapterId) {
      setSelectedChapter(null);
      setSelectedLecture(null);
    }
    toast({
      title: 'Chapter deleted',
      description: 'The chapter has been removed from the course.',
      //variant: 'destructive',
    });
  };

  const deleteLecture = (chapterId: number, lectureId: number) => {
    setChapters(
      chapters.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, lectures: chapter.lectures.filter((lecture) => lecture.id !== lectureId) }
          : chapter,
      ),
    );
    if (selectedLecture === lectureId) {
      setSelectedLecture(null);
    }
    toast({
      title: 'Lecture deleted',
      description: 'The lecture has been removed from the chapter.',
      //variant: 'destructive',
    });
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(chapters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setChapters(items);
  };

  const toggleChapter = (chapterId: number) => {
    setChapters(
      chapters.map((chapter) => (chapter.id === chapterId ? { ...chapter, isOpen: !chapter.isOpen } : chapter)),
    );
  };

  const selectedChapterData = chapters.find((chapter) => chapter.id === selectedChapter);
  const selectedLectureData = selectedChapterData?.lectures.find((lecture) => lecture.id === selectedLecture);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Create New Course</h1>

      <Card>
        <CardHeader>
          <CardTitle>Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="courseTitle" className="block text-sm font-medium text-gray-700 mb-1">
              Course Title
            </label>
            <Input
              id="courseTitle"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="Enter course title"
            />
          </div>
          <div>
            <label htmlFor="courseDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Course Description
            </label>
            <Textarea
              id="courseDescription"
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              placeholder="Enter course description"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Course Structure</span>
              <Button onClick={addChapter} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="chapters">
                  {(provided) => (
                    <ul {...provided.droppableProps} ref={provided.innerRef}>
                      {chapters.map((chapter, index) => (
                        <Draggable key={chapter.id} draggableId={chapter.id.toString()} index={index}>
                          {(provided) => (
                            <li ref={provided.innerRef} {...provided.draggableProps} className="mb-2">
                              <Collapsible open={chapter.isOpen} onOpenChange={() => toggleChapter(chapter.id)}>
                                <div className="flex items-center space-x-2 bg-secondary p-2 rounded-md">
                                  <span {...provided.dragHandleProps}>
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </span>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-0">
                                      {chapter.isOpen ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                  <button
                                    onClick={() => {
                                      setSelectedChapter(chapter.id);
                                      setSelectedLecture(null);
                                    }}
                                    className="flex-grow text-left hover:text-primary"
                                  >
                                    <Book className="h-4 w-4 inline mr-2" />
                                    {chapter.title}
                                  </button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteChapter(chapter.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <CollapsibleContent>
                                  <ul className="ml-6 mt-1 space-y-1">
                                    {chapter.lectures.map((lecture) => (
                                      <li key={lecture.id} className="flex items-center space-x-2">
                                        <button
                                          onClick={() => {
                                            setSelectedChapter(chapter.id);
                                            setSelectedLecture(lecture.id);
                                          }}
                                          className="flex-grow text-left text-sm hover:text-primary"
                                        >
                                          <FileText className="h-3 w-3 inline mr-2" />
                                          {lecture.title}
                                        </button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteLecture(chapter.id, lecture.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </li>
                                    ))}
                                  </ul>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-6 mt-1"
                                    onClick={() => addLecture(chapter.id)}
                                  >
                                    <PlusCircle className="mr-2 h-3 w-3" /> Add Lecture
                                  </Button>
                                </CollapsibleContent>
                              </Collapsible>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </DragDropContext>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chapter Title</label>
                    <div className="flex space-x-2">
                      <Input
                        value={selectedChapterData?.title || ''}
                        onChange={(e) => updateChapter(selectedChapter, e.target.value)}
                        placeholder="Enter chapter title"
                      />
                    </div>
                  </div>
                  {selectedLecture !== null && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lecture Title</label>
                        <Input
                          value={selectedLectureData?.title || ''}
                          onChange={(e) =>
                            updateLecture(
                              selectedChapter,
                              selectedLecture,
                              e.target.value,
                              selectedLectureData?.content || '',
                            )
                          }
                          placeholder="Enter lecture title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lecture Content</label>
                        <Textarea
                          value={selectedLectureData?.content || ''}
                          onChange={(e) =>
                            updateLecture(
                              selectedChapter,
                              selectedLecture,
                              selectedLectureData?.title || '',
                              e.target.value,
                            )
                          }
                          placeholder="Enter lecture content"
                          rows={10}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {selectedChapter === null && (
                <div className="text-center text-gray-500">Select a chapter or lecture to edit</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Button className="w-full" size="lg">
        Save Course
      </Button>
    </div>
  );
}
