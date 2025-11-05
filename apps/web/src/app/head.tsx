// app/head.tsx
export default async function Head() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
      next: { revalidate: 60 },
    });
    const data = await res.json();
    const firstCourse = data?.data?.[0];
    let playlistUrl = '';
  
    if (firstCourse?.bunnyVideoId) {
      const playlistRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/video/stream/${firstCourse.bunnyVideoId}`
      );
      const json = await playlistRes.json();
      playlistUrl = json.playlistUrl;
    }
  
    return (
      <>
        <title>Elearning Platform</title>
        <meta name="description" content="Learn instantly with autoplay video previews." />
        <link rel="preconnect" href="https://video.bunnycdn.com" crossOrigin="" />
        {playlistUrl && (
          <link
            rel="preload"
            as="fetch"
            href={playlistUrl}
            crossOrigin="anonymous"
          />
        )}
      </>
    );
  }
  