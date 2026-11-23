# Designer Video Studio

**[Browse Motion Index](https://maan-iitd2.github.io/designer-video-studio/)**. Watch an original short film, add your subject and copy its brief into a regular Claude chat. Each brief includes the source that drew the preview, a timed sequence and a critique pass. Try [Lunar Contact](https://maan-iitd2.github.io/designer-video-studio/#lunar-contact) for an archive-led story or [Offbeat](https://maan-iitd2.github.io/designer-video-studio/#offbeat) for kinetic type.

## Make a film in Claude chat

**Start with an editable project.** Open a reference and choose **Download scene-by-scene rebuild** or **Download style starter**, or [download all 240 projects](https://maan-iitd2.github.io/designer-video-studio/remakes/all-projects.zip) and open `Start.html` after extracting. Each project contains an `Edit.html` shot editor. Change wording, colors, timing or order, add your own media and save over the project's `edit.json`. To get Claude's help with copy, attach just that file to a regular chat and ask for the specific change. A preview or export uses no model tokens.

For preview and export, install Python 3.9+ and Node.js 22+. In the extracted project run `python project.py preview` or `python project.py render`. On Windows, double-click **Preview.cmd** or **Render.cmd**. Render writes `film.mp4`. The first run fetches the pinned HyperFrames CLI and playback uses GSAP from its CDN.

Stephan Livera’s showreel has a scene-by-scene rebuild with editable typography, generated geometry and an original beat. Its gallery entry includes a preview of the actual exported project. The other 239 downloads are generic style starters. Of those, 162 use measured timing and palettes and 77 use suggested timing. The creator player shows the reference film. Each download retains the creator’s credit and source link.

### Local reference footage

From any extracted gallery project, run `python Get-footage.py` or double-click **Get footage.cmd** on Windows. This requires FFmpeg with ffprobe. It checks the original post and saves available videos in `footage/`. Each attachment gets an editable cut such as `edit-footage-1.json`. Load that file in the shot editor or run `python project.py render --edit edit-footage-1.json`. This works without cloning the repo.

An unchanged footage timeline exports a byte-for-byte copy of the MP4. For trims and reordering a single video, the exporter uses FFmpeg directly. Mixed media and animated graphics use HyperFrames.

The November 23 download pass saved 167 verified MP4s from 163 posts (2.35 GB decimal). On 59 posts the media exposed no download setting, 12 had no verifiable video belonging to that post and six post pages were unavailable. Availability can change. Original MP4s and the download manifest stay in the local `downloads/x/` folder.

From a clone of this repo with Python and FFmpeg (including ffprobe) on PATH:

```sh
python scripts/download_references.py gonzalomacagno-2de1a9
python scripts/remake.py gonzalomacagno-2de1a9 --source-cut
python films/gonzalomacagno-2de1a9-source/project.py preview
```

Omit the ID on the downloader to check the whole collection. It checks the post's download setting, verifies MP4s, reuses existing complete files and records results by creator and post. `--source-cut` puts the actual footage into an editable sequence with source trim points. For a post with multiple videos, pass `--media-position 2` to the project generator to use the second video. For an animation built from editable components, run `python scripts/remake.py ID`. To update measured timing and palette profiles after downloading new clips, run `python scripts/analyze_references.py`. Public sharing of an edited film depends on the terms for the footage, music and assets you use.

The [searchable Prompt Motion references](https://maan-iitd2.github.io/designer-video-studio/#references) include 240 films from 219 creator handles in the November 23, 2026 snapshot. Search by subject, creator, visual attributes or tool, then filter by format and prompt or skill. Each result opens its original creator post on demand and has a customizable Claude adaptation brief. [Try paper collage](https://maan-iitd2.github.io/designer-video-studio/?q=paper+collage#references).

1. Open a film and choose its format, script mode and subject.
2. Select **Copy Claude brief**, open Claude and paste it into a new chat. Attach your own photos or sketches. **Save reference frames** gives you three frames to attach if the layout matters.
3. Review the short animated pilot before asking for the full cut. The brief asks for an editable HTML artifact. MP4 output depends on the tools available in your chat.

## Work locally with Claude Code

1. Clone this repository using GitHub Desktop or run `git clone https://github.com/maan-iitd2/designer-video-studio.git`.
2. Open the cloned folder as a project in Claude Code.
3. Describe your video. For example, “I have a sketch and a screen recording. Use shotcraft/card-stack to introduce my lettering project.” Claude helps you choose a look, checks which assets you have and builds a short pilot for review.

The [starter guide](START%20HERE.md) covers local previews and revisions. The [video director skill](.claude/skills/direct-video/SKILL.md) and the renderers work in the cloned project. Browse the [803-entry shot archive](https://maan-iitd2.github.io/designer-video-studio/archive/) when you want individual components.

## Tools and sources

| Resource | What it contributes | Original project |
|---|---|---|
| Herk Edit Kit | 106 Vox-style and 300 Kallaway-style HTML cards. The [bundled styles](library/herk-edit-kit/style-library) include the editable layouts and design notes. | [Herk Edit Kit](https://github.com/nateherkai/herk-edit-kit) |
| Video Shotcraft | 124 [shot recipes](library/video-shotcraft/references/shots), 150 motion variants, MP4 previews and a Remotion project template. | [Video Shotcraft](https://github.com/Vincentwei1021/video-shotcraft) |
| HyperFrames | 238 editable [components](library/hyperframes/registry/components) and nine [example sequences](library/hyperframes/registry/examples). | [HyperFrames](https://github.com/heygen-com/hyperframes) |
| Remotion | Renderer for React-based compositions, including the Shotcraft template. | [Remotion](https://github.com/remotion-dev/remotion) |
| OpenFilm | An editor for working with a film on a timeline. | [OpenFilm](https://github.com/openfilm/openfilm) |
| OpenMontage | Production workflows for sourcing stock and planning documentary or generated shots. | [OpenMontage](https://github.com/OpenMontageInc/OpenMontage) |
| Prompt Motion | A browsable reference library of finished motion examples and creator prompts. | [Prompt Motion](https://prompt-motion.com/) |
| i-have-adhd | The [bundled skill](.claude/skills/i-have-adhd) for short, action-first conversations. | [i-have-adhd](https://github.com/ayghri/i-have-adhd) |

The [source inventory](SOURCES.md) records upstream snapshots, licenses and attribution. Individual preview media, brand assets, music and fonts carry their respective terms. Use your own material when adapting a shot.
