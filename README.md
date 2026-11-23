# Designer Video Studio

**[Browse Motion Index](https://maan-iitd2.github.io/designer-video-studio/)**. Watch an original short film, add your subject and copy its brief into a regular Claude chat. Each brief includes the source that drew the preview, a timed sequence and a critique pass. Try [Lunar Contact](https://maan-iitd2.github.io/designer-video-studio/#lunar-contact) for an archive-led story or [Offbeat](https://maan-iitd2.github.io/designer-video-studio/#offbeat) for kinetic type.

## Make a film in Claude chat

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
