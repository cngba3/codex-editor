# Review BĐS recipe

This recipe reconstructs the **EDITED inner video** of the supplied TikTok reference. Read [SYSTEM.md](SYSTEM.md) for the frame-by-frame style grammar. The comparison frame, RAW inset and EDITED label are presentation only.

## App pipeline

1. Import a talking-head source and choose `review-bds` in the app. The Ghost Editor pipeline selects takes, transcribes Vietnamese speech, tracks the face and plans text from source word timestamps.
2. `server/review-bds-schema.json` requires each text part to name its visual role and motion, and each Pexels media window to name its entrance. `server/review-bds-layout.ts` checks every displayed word against the transcript and limits glitch accents. Unsupported or invented wording is discarded.
3. `server/jobs.ts` downloads relevant Pexels imagery or video, keeping source attribution. One photo becomes a blurred-background card; three distinct photos can become a teal gallery. The gallery reverts to a card when there are too few suitable photos.
4. `ghost-editor/scripts/build.mjs` and `scripts/lib/review-bds-type.mjs` render the type, transitions, captions and SFX. The emphasized text suppresses ordinary subtitles for its full visible interval. Structural accents get quiet whooshes or hits; ordinary cuts and white support wording stay quiet.
5. Render and review frames at every type and media beat, then check caption duplication, source wording, text fit, media relevance, SFX balance and contrast. The preview must be reviewed before final delivery.

The reference is a compressed showcase, so its exact source fonts, plugin settings and isolated SFX files are unavailable. The recipe reproduces observed timing, typography, palette and motion grammar with seek-safe effects. A new video still depends on the supplied speech and on matching Pexels material.
