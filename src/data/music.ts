/**
 * The music player's tracks. This is the one place audio is configured.
 *
 * Put a file in /public/audio and list it here, e.g.
 *   { title: 'Night drive', artist: 'Yug', src: '/audio/night-drive.mp3' }
 *
 * The player supports any number of tracks (previous/next step through
 * them). With none listed it still renders, quiet, with its controls off.
 */
export type Track = {
  title: string
  artist?: string
  /** A path under /public, or a full URL the browser may play. */
  src: string
  /** Its length in seconds, shown before anything is downloaded (the audio
   *  loads only when play is pressed); the file's own length replaces it then. */
  duration?: number
}

export const TRACKS: Track[] = [
  { title: 'Infrunami', artist: 'Steve Lacy', src: '/audio/infrunami.mp3', duration: 178.36 },
  { title: 'After The Storm', artist: 'Kali Uchis, Tyler, The Creator & Bootsy Collins', src: '/audio/after-the-storm.mp3', duration: 207.49 },
  { title: 'Sure Thing', artist: 'Miguel', src: '/audio/sure-thing.mp3', duration: 195.42 },
  { title: 'grateful', artist: 'Dhruv', src: '/audio/grateful.mp3', duration: 241.5 },
  { title: 'Shut up My Moms Calling', artist: 'Hotel Ugly', src: '/audio/shut-up-my-moms-calling.mp3', duration: 164.6 },
]
