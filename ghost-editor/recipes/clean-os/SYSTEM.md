# Clean OS — sampled opening from @lamdiphuc

Reference: https://www.tiktok.com/@lamdiphuc/video/7666082367504878856
Evidence: 0.00–5.00 s local sample and the five consecutive screenshots supplied by the user. Do not infer unseen scenes.

## Observed timeline

| Time | Picture and text | Motion |
| --- | --- | --- |
| 0.0–0.8 | Warm, ungraded speaker shot. Short white heavy sans phrase at chest height. | The phrase changes on speech; no app interface. |
| 0.8–1.8 | White handwritten word above the head, a warm yellow handwritten number beside a bold white phrase at chest height. | Small, quick reveals keyed to words and a hand gesture. The speaker remains visible. |
| 1.8–2.6 | Yellow rough handwritten product phrase at the chest; white handwritten word above the head remains briefly. | The handwritten phrase writes or wipes into place. |
| 2.6–4.6 | Full black slide with four centered lines of tightly tracked heavy sans; line two is yellow, others white. Tiny, sparse film specks. | Hard cut in, held still while the voice continues; no observed swipe. |
| 4.6–5.0 | Hard cut back to the same speaker shot with short white words at chest height. | Direct cut and quick word replacement. |

The screenshot sequence also shows a different opening phrase: thin elegant yellow “edit video” closely paired with heavy white “nhanh hơn” on the chest, then a quiet tiny white spoken subtitle, then white rough “setting” above the head with a pointing hand. A rough yellow “Capcut PC” appears on the chest, followed by a rough yellow “4” and bold white “cài đặt” on one line. These screenshots establish the typography and placement; they do not establish exact timestamps for a new raw clip.

## House grammar

- Keep the speaker's source colors and skin tone. The sampled room is warm amber, with black clothing, a red cap, and a green desk mat; these are footage colors, not graphics that must be fabricated for every reel.
- Use heavy compact Inter Tight for white spoken anchors, elegant Dancing Script for the thin yellow key phrase, rough Caveat for a yellow chalk product word or number, and rough Patrick Hand for a white upper note. Bundle Vietnamese and Latin font subsets so English and Vietnamese words both render in the intended typeface.
- Use warm lemon yellow (#F7E769) and warm white (#F7F6F1). Pair the yellow elegant line tightly with a white bold line below it. Keep the rough yellow chalk line visually distinct from the elegant script. Normal captions between emphasized beats are small white serif near the lower chest.
- Within a thought, reveal two to four short text runs on their spoken onsets and keep earlier runs visible until that thought ends. Give each run its own line or safe position, so the viewer sees a growing composition rather than unrelated white words replacing one another.
- Use an upper handwritten label only when the footage leaves room above the head. Do not cover the face. A small pointing cue, rough underline, and restrained glow match the sampled “setting” frame.
- A black statement slide is an idea break, not a phone UI scene. Use two to four centered lines; one important spoken line is yellow. Keep line widths inside one safe rectangle. A few fixed grain specks are enough.
- Reveal words on their spoken onsets. Keep transitions quick: a brief opacity or blur resolve for white words, a 0.2–0.4 s wipe for writing. Cut directly between the speaker and black slide. No app opening, iOS widgets, swipes, Figma box, or OS color palette were observed in these five seconds.
- Choose devices from the actual new speech. Numbers and product names appear only when spoken. Preserve a complete thought on each black slide. Do not repeat the reference's words.
- Audio treatment is unverified by this silent visual study. Do not infer a signature sound effect or soundtrack.

## Clean OS build

Use CleanOS.layered_words with layout="paired" for the tight elegant-yellow/white-bold chest hook; use layout="stack" for longer accumulating phrases. Use talk_line, handwritten(variant="chalk" or "marker"), number_line, and black_statement for shorter beats and a real rhetorical break. The first seconds should show the speaker with a distinctive white/yellow font pairing. Keep enough speaker time for the face to anchor the reel. Use the source transcript and exact edit-time word boundaries. Existing phone/UI methods remain available for old projects but are not part of this reference grammar.
