# Designer Video Studio

**[Browse the shot library](https://maan-iitd2.github.io/designer-video-studio/)**. Search by subject or movement, play a preview and copy the shot ID. You can share a specific shot by copying the browser address while its card is open. [Try the card-stack shot](https://maan-iitd2.github.io/designer-video-studio/#shotcraft%2Fcard-stack).

## Make a video

1. Clone this repository using GitHub Desktop or run `git clone https://github.com/maan-iitd2/designer-video-studio.git`.
2. Open the cloned folder as a project in Claude Code.
3. Describe your video. For example, “I have a sketch and a screen recording. Use shotcraft/card-stack to introduce my lettering project.” Claude helps you choose a look, checks which assets you have and builds a short pilot for review.

The [starter guide](START%20HERE.md) covers local previews and revisions. The website works on its own for browsing. The [video director skill](.claude/skills/direct-video/SKILL.md) and the renderers work in the cloned project.

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
