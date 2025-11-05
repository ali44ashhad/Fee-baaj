import debounce from 'lodash.debounce';
import { useCallback, useEffect, useState } from 'react';

interface YoutubePreviewProps {
  videoUrl: string;
}

export default function YoutubePreview({ videoUrl }: YoutubePreviewProps) {
  const [videoId, setVideoId] = useState<string | null>(null);

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const debouncedExtractVideoId = useCallback(
    debounce((url: string) => {
      const extractedId = extractVideoId(url);
      setVideoId(extractedId);
    }, 300),
    [],
  );

  useEffect(() => {
    debouncedExtractVideoId(videoUrl);
    return () => {
      debouncedExtractVideoId.cancel();
    };
  }, [videoUrl, debouncedExtractVideoId]);

  return (
    <>
      {videoId && (
        <div className="aspect-video mt-2">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
    </>
  );
}
