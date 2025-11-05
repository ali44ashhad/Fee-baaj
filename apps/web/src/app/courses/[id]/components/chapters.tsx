'use client';

import { useState } from 'react';
import { Collapsible } from '@/components/ui/collapsible';
import { IChapterResponse } from '@elearning/types';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';
import Button from '@/components/ui/button';
import axios from 'axios';

interface Lecture {
  title: string;
  video?: string;
  videoPopups?: { id?: string; link: string; popupDuration?: number; triggerAt?: number }[];
  duration?: number | undefined;
}

interface ChaptersProps {
  chapters: IChapterResponse[];
}

export default function Chapters({ chapters }: ChaptersProps) {
  const [showAll, setShowAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lVideoId, setLVideoId] = useState('');
  const [playListUrl, setPLayListUrl] = useState('');
  const [lVideoPopups, setLvideoPopups] = useState<any[]>([]);

  const visibleChapters = showAll ? chapters : chapters.slice(0, 4);
  const remainingChapters = chapters.length - 4;

  const handleLectureClick = async (videoId: string, videoPopups: any[]) => {
    if (!videoId) return alert('No video lecture available yet');

    const abortController = new AbortController();
    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/video/stream/${videoId}`, {
      withCredentials: true,
      signal: abortController.signal,
    });

    const playlistUrl = response.data.playlistUrl;
    setPLayListUrl(playlistUrl);
    setLVideoId(videoId);
    setLvideoPopups(videoPopups);

    setIsModalOpen(true);
  };

  function formatDuration(sec: number = 0) {
    const total = Math.floor(sec); // drop decimals
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="mt-10">
      <h2
        style={{ color: '#403D3D' }}
        className="text-xl  mid0:text-[19px] mid1:text-[21px] mid2:text-[24px] mid3:text-[26px] mid4:text-[26px] font-bold mb-4"
      >
        Free Full Course Content
      </h2>

      <div className="bg-white border overflow-auto">
        {visibleChapters.map((chapter, cIndex) => (
          <div key={cIndex}>
            <Collapsible
              defaultOpen={cIndex === 0}
              triggerRender={(isOpen) => (
                <div style={{ background: '#f6f7f9' }} className="flex w-full justify-between items-center  py-3">
                  <div className="flex  gap-2 items-center">
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-gray-800" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-800" />
                    )}
                    <h2 className="font-bold text-gray-800 tiny:text-[12px] xs:text-sm truncate w-full">{chapter.title}</h2>
                  </div>
                  <p className="text-gray-600 whitespace-nowrap  tiny:text-[12px] xs:text-sm">{chapter.lectures.length} lectures</p>
                </div>
              )}
            >
              {chapter.lectures.map((lecture, lIndex) => (
                <div
                  key={lIndex}
                  className="flex justify-between items-center gap-2 bg-white py-3 px-6 cursor-pointer"
                  onClick={() => handleLectureClick(lecture.video, lecture.videoPopups as any[])}
                >
                  <div className="flex items-center gap-4 w-[80%]">
                    <div className="flex items-center justify-center bg-primary rounded-full w-5 h-5 overflow-hidden flex-shrink-0">
                      <Play className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-gray-800 tiny:text-[10px] xs:text-[12px] text-sm w-full block">{lecture.title}</span>
                  </div>
                  <span className="text-gray-400 whitespace-nowrap">{formatDuration(lecture.duration)}</span>
                </div>
              ))}
            </Collapsible>
          </div>
        ))}
      </div>

      {remainingChapters > 0 && (
        <Button
          className="text-center w-full text-gray-600 hover:text-gray-900 p-2 bg-gray-100 mt-4"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show Less' : `Show More Sections`}
        </Button>
      )}

      {/* <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {playListUrl && lVideoId && (
          <VideoPlayer
            videoId={lVideoId}
            playlistUrl={playListUrl}
            videoPopups={lVideoPopups || []}
            shouldPlay={true}
          />
        )}
      </Modal> */}
    </div>
  );
}
