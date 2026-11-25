/** Camera helpers: open the rear camera at high resolution, grab frames, torch. */

export async function openRearCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot use the camera. Open the app over HTTPS in Chrome or Safari.')
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  })
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}

export function torchSupported(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0]
  const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
  return !!caps?.torch
}

export async function setTorch(stream: MediaStream | null, on: boolean): Promise<void> {
  const track = stream?.getVideoTracks()[0]
  await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
}

/** Draw a source into a reusable canvas at the given size and return its pixels. */
export function grabPixels(
  source: CanvasImageSource,
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
): ImageData {
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}
