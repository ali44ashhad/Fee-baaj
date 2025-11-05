import MuxPlayer from '@mux/mux-player-react';

interface VideoPreviewProps {
  playbackId: string;
}

export default function VideoPreview({ playbackId }: VideoPreviewProps) {
  return (
    <div className="aspect-video w-full">
      <MuxPlayer
        playbackId={playbackId}
        metadata={{
          video_id: playbackId,
          video_title: 'Lecture Video',
        }}
        streamType="on-demand"
        style={{
          height: '100%',
          maxWidth: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
