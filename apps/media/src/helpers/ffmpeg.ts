import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

export type Rendition = {
  name: string;      // e.g., "720p"
  height: number;    // e.g., 720
  maxrate: string;   // e.g., "800k"
  bufsize: string;   // e.g., "1600k"
  bandwidth: number; // numeric bps for master playlist (computed)
  width?: number;    // filled later based on source aspect ratio
};

const PRESET = 'fast';
const CRF = '23';

// parse bitrate like "800k" -> 800000
function parseBitrate(str: string) {
  const m = /(\d+)(k?)/i.exec(str);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 'k' ? n * 1000 : n;
}

export async function probeVideo(filePath: string) {
  return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
    const args = ['-v', 'error', '-print_format', 'json', '-show_streams', filePath];
    const proc = spawn(ffprobePath.path, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffprobe failed'));
      try {
        const json = JSON.parse(out);
        const vstream = (json.streams || []).find((s: any) => s.codec_type === 'video');
        if (!vstream) return reject(new Error('no video stream'));
        resolve({
          width: Number(vstream.width),
          height: Number(vstream.height),
          duration: Number(vstream.duration || 0),
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

function computeWidth(srcW: number, srcH: number, targetH: number) {
  // Preserve aspect ratio; width must be even
  const w = Math.round((srcW * targetH) / srcH);
  return w % 2 === 0 ? w : w - 1;
}

async function runFFmpeg(args: string[], cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath as string, args, { stdio: ['ignore', 'inherit', 'inherit'], cwd });
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    ff.on('error', (err) => reject(err));
  });
}

/**
 * Transcode a single rendition into HLS files.
 * Writes playlist at outDir/<renditionName>/playlist.m3u8 and segments there.
 */
export async function transcodeRendition(
  input: string,
  outDir: string,
  rendition: Rendition
): Promise<{ playlist: string; rendition: Rendition }> {
  await fs.ensureDir(outDir);
  const rendDir = path.join(outDir, rendition.name);
  await fs.ensureDir(rendDir);

  // output playlist path
  const playlistPath = path.join(rendDir, 'playlist.m3u8');

  // build ffmpeg args
  // scale to target height (-2 keeps aspect and even width)
  const version = Date.now(); // unique per transcode job
  const args = [
    '-y',
    '-i',
    input,
    '-c:v',
    'libx264',
    '-preset',
    PRESET,
    '-crf',
    CRF,
    '-vf',
    `scale=-2:${rendition.height}`,
    '-maxrate',
    rendition.maxrate,
    '-bufsize',
    rendition.bufsize,
    '-g',
    '48',
    '-keyint_min',
    '48',
    '-sc_threshold',
    '0',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    // ** changed segment duration to 4 seconds **
    '-hls_time',
    '4',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    path.join(rendDir, `${rendition.name}_seg_${version}_%03d.ts`),
    playlistPath,
  ];

  await runFFmpeg(args);
  return { playlist: playlistPath, rendition };
}

/**
 * Produce HLS for the requested targets.
 * - decides which renditions to create (no upscaling)
 * - runs transcodeRendition for each chosen rendition
 * - writes master.m3u8 linking them
 */
export async function transcodeToHLS(
  inputPath: string,
  outputRoot: string,
  requestedRenditions: Rendition[]
): Promise<{ outDir: string; masterPlaylist: string; renditions: Rendition[] }> {
  // probe
  const meta = await probeVideo(inputPath);
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcH || !srcW) throw new Error('Invalid source dimensions');

  // pick renditions that are <= source height (no upscaling)
  let chosen = requestedRenditions.filter((r) => r.height <= srcH);

  // ensure at least the smallest if nothing matches
  if (chosen.length === 0) {
    chosen = [requestedRenditions[requestedRenditions.length - 1]];
  }

  // compute width and bandwidth for each rendition
  chosen = chosen.map((r) => {
    const width = computeWidth(srcW, srcH, r.height);
    return {
      ...r,
      width,
      bandwidth: Math.round(parseBitrate(r.maxrate) * 1.2), // give some headroom
    };
  });

  // prepare out folder
  const videoName = path.basename(inputPath, path.extname(inputPath));
  const outDir = path.join(outputRoot, `${videoName}-${Date.now()}`);
  await fs.ensureDir(outDir);

  const created: Rendition[] = [];

  for (const r of chosen) {
    // transcode each rendition
    await transcodeRendition(inputPath, outDir, r);
    created.push(r);
  }

  // build master playlist
  const masterPath = path.join(outDir, 'master.m3u8');
  const lines: string[] = ['#EXTM3U'];

  for (const r of created) {
    // relative path from master to rendition playlist
    const relPlaylist = path.join(r.name, 'playlist.m3u8').replace(/\\/g, '/');
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height}`,
      relPlaylist
    );
  }

  await fs.writeFile(masterPath, lines.join('\n') + '\n', 'utf8');

  return { outDir, masterPlaylist: masterPath, renditions: created };
}
