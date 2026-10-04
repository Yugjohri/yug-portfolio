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
}

export const TRACKS: Track[] = [
  { title: 'Infrunami', artist: 'Steve Lacy', src: '/audio/infrunami.mp3' },
  { title: 'After The Storm', artist: 'Kali Uchis, Tyler, The Creator & Bootsy Collins', src: '/audio/after-the-storm.mp3' },
  { title: 'Sure Thing', artist: 'Miguel', src: '/audio/sure-thing.mp3' },
  { title: 'grateful', artist: 'Dhruv', src: '/audio/grateful.mp3' },
  { title: 'Shut up My Moms Calling', artist: 'Hotel Ugly', src: '/audio/shut-up-my-moms-calling.mp3' },
]
