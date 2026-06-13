# Profile Song — Proof of Concept

Instagram-style "song on your profile": search a track, attach it, and play its 30s
preview from a pill on the profile. Frontend-only PoC — no backend, no new native module.

## How it works

- **Search**: hits the public **iTunes Search API** directly from the client (no auth, no key, no backend endpoint). 30s preview clips come back as `previewUrl`.
- **Playback**: reuses the already-installed **`expo-video`** player to play the preview m4a (audio-only, hidden 1px view). No `expo-audio`, so **no dev-client rebuild** — runs on your existing dev client.
- **Persistence**: `AsyncStorage` (`poc:profileSong`). The real version would store this on the user via the existing `PATCH /v1/profiles/{id}`.

## Files

| File | What |
|---|---|
| `frontend/api/itunes.ts` | iTunes search + response→`Song` mapping (pure, unit-tested) |
| `frontend/__tests__/itunes.test.ts` | 3 passing logic tests |
| `frontend/components/profile/song/SongPickerModal.tsx` | Debounced search sheet → tap to attach |
| `frontend/components/profile/song/ProfileSongWidget.tsx` | The pill: play/pause preview, change song |
| `frontend/components/profile/song/Equalizer.tsx` | Animated equalizer bars while playing |
| `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx` | Renders `<ProfileSongWidget />` under the edit row |

## Run it

```bash
cd frontend
bun start          # then open in your existing dev client
```

Go to the **Profile** tab → "Add a song to your profile" → search → tap a result →
tap the pill to play/pause. **Ringer must be on** (iOS silent switch mutes it; a real
build would set the playback audio-session category).

## Verify

```bash
cd frontend
bunx jest itunes   # 3 pass
bunx tsc --noEmit  # only the 14 pre-existing DatePager errors
```

## Not in scope (intentionally)

- Backend persistence (one field on the user + the existing PATCH — ~0.5d).
- Album artwork (dropped per scope).
- Songs on *posts* + autoplay-as-you-scroll (the deferred feed-viewability work).
