# Music: design (approved in chat, 2026-11-28)

Intent: students pick background music by type while using Ufq; it keeps playing as they move around.

Goals: Music section in the side menu; small pop-up player from a button next to "Start session" on Today; daily mix; admins add and remove songs. No video, no third-party player UI.
Non-goals: chart hits; own audio hosting. Anti-goal: music during mock tests.

Approaches: YouTube (rejected: its policy forbids hidden or audio-only players), Spotify embed (visible player, previews for many), own uploads (licensing, storage limits), Audius API (chosen: free full audio streams, our own player; independent artists only).

How: `public/dc/music.js`. The page that owns the audio stays alive and later pages open in a same-origin frame over it.
Built-in lists in `public/dc/music-tracks.json` (picked by metadata, not by ear); admin changes in `music_tracks` (`supabase/migrations/20261206_music.sql`).
