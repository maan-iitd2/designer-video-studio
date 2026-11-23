---
name: direct-video
description: Guide a designer from a video idea or reference to a style choice, script, assets, pilot and editable finished video. Also use to resume a film or revise a shot.
---

# Direct a video

Treat the designer as the creative director. Speak in her language. Open with the one decision she can make now. Give two or three numbered options when a choice helps. Show what is settled in one short line when returning to a project. Do the technical work yourself. The included i-have-adhd skill informs these conversation defaults. She can request fuller explanations or normal replies at any time.

## Find the direction

1. Extract what she already told you. With only “make me a video,” first ask what it is for. Offer concrete possibilities such as showing work, explaining an idea or editing a recording. With a known goal, go straight to visual choices. Ask about audience, destination, length or orientation when it changes a decision. Accept “you choose.”
2. Start with the local visual catalog, `library/index.html`. From the project root search with `python library/find.py "search words"`. Read only the returned matches. Give her the preview and exact shot ID. On selection, look up the ID and open its source file and required dependencies. A new search is useful when the next beat needs a different technique. Open [directions.md](references/directions.md) when she needs examples. Offer two or three genuinely different relevant looks. For each, send a direct playable example or gallery entry and say what she could borrow for *her* subject. Invite her own Pinterest screenshots, reels, timestamps or Draft 2. If a link is private, use a screenshot or her description. If you have only text describing a video, describe the documented technique. Never claim to have watched it. If her style is clear, use it immediately. For a look outside the list, find one matching example and propose a feasible route.
3. Translate her choice into a sentence about type, palette, imagery and movement. Distinguish what she liked in each reference. Capture any must-avoid. Offer to remember recurring taste in a short project-root `preferences.md` if she asks. A new film can override it.

## Decide what goes into the film

4. Resolve script ownership *before writing*. **Use my exact words**, **shape my notes**, **write a draft from my facts**, and **visuals only** are all valid. For recorded speech, work from its actual timing. For a draft, ask for the message and supporting facts, write one version sized to the runtime, and mark claims that need her input. Keep approved wording as supplied.
5. Inventory the designated files by name and metadata. Ask only for the missing element that changes the cut. Track each needed photo, clip, logo, screenshot, chart, VO, music or SFX as supplied / to source / to create / omit. Mark private references as inspiration. Use her real work for portfolio proof. For gaps, offer a specific substitute, e.g. animate her sketch, use a credited image, or generate one named insert at a quoted cost. Treat voice and music as creative choices. A silent or text-led film is valid.
6. Create `films/<project>/brief.md` using [film-brief.md](references/film-brief.md). It holds a short shot list, rights, creative decisions, cost and the next action. Link to assets instead of copying their contents into chat. On resume, read this file first. If multiple films could match, ask which one.

## Pilot, produce, revise

7. Pick one renderer from [production.md](references/production.md). Show a compact storyboard with time, exact words/audio cue, visible subject and motion for each beat. Render **one representative 3–5 second pilot** from the hardest or most characteristic beat using real assets where available. Clearly label temporary substitutes. Show it at the intended aspect ratio with a playable local link. Ask one decision covering the storyboard and sample together. If she changes direction, revise only that beat. If she explicitly delegated approval, continue under her instructions.
8. After the look and content are accepted, **build and export**. Parameterize recurring scenes with copy, media, crop, cue and colour. Save the selected recipe and versions. Run local previews and encoding outside the language model. For revisions, preserve the previous export, patch the requested shot, preview that interval, then assemble or render the final. A global change such as duration or aspect ratio may also affect adjacent shots.
9. Check the actual output dimensions, duration, decoding and intended audio. Inspect legibility, crop, transitions, name spelling and narration sync using representative frames plus the changed interval. Compare with the approved brief. Deliver the MP4, editable source, credits and a short cost/usage note. Report any unresolved issue plainly. Save repeatable scene settings for the next film.

## Spend discipline

For a Prompt Motion reference, start with its downloadable project or run `python scripts/remake.py ID`. Read only that project's edit.json. Adjust its copy, timings, palette and supplied asset paths, then run project.py preview or render. Keep the original attribution and timing provenance. A designer in regular Claude chat can attach just edit.json and save the revised file in the same project. Generate fresh animation code only for a requested effect the selected components cannot express.

For an aesthetic review, aim for 9/10 per applicable axis: composition and hierarchy, typography and phone readability, visual originality and fit to the story, and motion and timing. Review the rendered frames and the transitions between them. Check audio sync when audio is present. Cite the timestamp of the weakest decision and revise that beat, then compare before and after. Mark anything you could not view as unverified. Let the designer decide if the film lands.

Use a lower-cost available model for intake, scripting, asset inventory and filling scene parameters. If the host cannot switch models, keep the current task narrow and tell her how to choose a smaller available model if it matters. One coordinator by default. For a difficult shot, price a single targeted escalation. Avoid generating bespoke shot engines, repeated reference studies or open-ended critic passes.

Work without a preset spending target. Reuse local assets and rendering. If she gives a budget for a film, record it and compare paid commitments and expected finishing costs against it. Quote any new paid media or provider work before committing to it. Keep actual expenses separate from estimates.

On subscriptions, keep plan usage and cash expenses separate. If exact usage is unavailable, mark it unknown, log bounded work units (one pilot, one targeted correction, one final render), and use local or already-owned assets. Never present allowances as spend or guarantee a dollar cap from chat instructions. For metered API use see [production.md](references/production.md) for per-call limits. If a pilot fails twice for the same reason, diagnose from a short error excerpt and offer a simpler approved treatment before spending on another attempt.
