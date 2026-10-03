// Records a canvas to a video file with MediaRecorder. Safari (and so iPhone)
// records MP4; Chrome and Firefox record WebM.

const CANDIDATE_TYPES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function pickVideoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATE_TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function extensionFor(mimeType: string): string {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export interface CanvasRecording {
  stop: () => Promise<Blob>;
  mimeType: string;
}

export function recordCanvas(canvas: HTMLCanvasElement, fps: number = 30): CanvasRecording {
  const mimeType = pickVideoMimeType();
  if (!mimeType) throw new Error('This browser cannot record video (MediaRecorder unsupported).');

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  return {
    mimeType,
    stop: () =>
      new Promise<Blob>(resolve => {
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          resolve(new Blob(chunks, { type: mimeType.split(';')[0] }));
        };
        recorder.stop();
      }),
  };
}
