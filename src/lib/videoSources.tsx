/**
 * Every clip is published twice in /public/video: an .mp4 (H.264, plays
 * everywhere) and a smaller .webm (VP9) beside it with the same name. A clip is
 * referred to by its .mp4; the WebM is offered first, the MP4 the fallback.
 */
export const webmOf = (mp4: string) => (mp4.endsWith('.mp4') ? mp4.slice(0, -4) + '.webm' : null)

/** The <source>s for a <video>: the WebM sibling, then the MP4; `media`
 *  limits them to the screens it matches (a phone's smaller copy, say). */
export function VideoSources({ src, media }: { src: string; media?: string }) {
  const webm = webmOf(src)
  return (
    <>
      {webm ? <source src={webm} type="video/webm" media={media} /> : null}
      <source src={src} type="video/mp4" media={media} />
    </>
  )
}

/** The same, for a <video> made in code. */
export function addVideoSources(video: HTMLVideoElement, src: string) {
  const webm = webmOf(src)
  const add = (s: string, type: string) => {
    const el = document.createElement('source')
    el.src = s
    el.type = type
    video.appendChild(el)
  }
  if (webm) add(webm, 'video/webm')
  add(src, 'video/mp4')
}
