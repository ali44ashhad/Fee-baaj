// app/courses/[id]/head.tsx

export default async function Head({ params }: { params: { id: string } }) {
    // 🔐 Preload should use no-store since it's auth-based
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/video/stream/${params.id}`,
      {
        cache: 'no-store',
        credentials: 'include', // ✅ Important if using auth cookies
        headers: {
          'Cache-Control': 'no-store', // optional extra safeguard
        },
      }
    );
  
    const { playlistUrl } = await res.json();
  
    return (
      <>
        <title>Course Details | My Elearning</title>
        <meta name="description" content="Watch the course intro instantly." />
  
        {/* ⚡ Speed up the TLS handshake to BunnyCDN */}
        <link rel="preconnect" href="https://video.bunnycdn.com" crossOrigin="" />
  
        {/* 🎬 Preload the intro HLS manifest */}
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
  