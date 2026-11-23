# Make your own paper film

Open **demo.mp4** to watch the eight-second sample. **board.png** shows its three shots side by side. This folder contains the paper textures, halftone treatment, animation code, fonts, example cutouts and renderer. You can make a new cut by editing one file, **shots.json**.

## Start with something worth showing

Record a scratch voiceover on your phone. A clean recording or an existing mixed soundtrack works. Choose one visual idea that can return at the end. For a designer introducing a handwriting project, a useful sequence would be a handwritten word on paper, the same word being drawn in the actual product, and a finished letter someone can read. Use your own screen capture for the middle shot. A generic laptop communicates much less.

Put your audio and images in **assets/**. A transparent PNG works well for an object on paper. Use a cropped screenshot for product proof. Each title or prop should arrive on a specific spoken word. Play the recording once and write down those times. For a longer script, import the word times from your transcription tool and check the important nouns by ear.

## Try the sample locally

From this unzipped folder, run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8000/). Press Play or scrub. Save changes to shots.json and refresh the browser. This preview needs Python 3 and a current desktop browser. It reads the bundled files locally.

## Edit the shot list

| Field | What to enter |
|---|---|
| audio | A relative path such as `assets/voice.wav`. Keep `null` for a silent film. Use a finished mix for voice and music together. |
| start, duration | Seconds. Start the first shot at zero and each following shot at the end of the previous one. Match the last end time to your audio. |
| cue | Seconds **after this shot starts** when its prop enters. For a word at 6.8 s in a shot starting at 6.0 s, enter 0.8. Titles have layout-specific entrances. |
| layout | `masthead` places a cutout in front of large type. `exhibit` places it on dark newsprint with room for an explanation. `reveal` uses a torn sky strip on cream. |
| title, caption | Plain text. Prefer one to three title words and one short caption so both read at phone size. |
| image | Relative path to a local image. For a product screenshot, add `"fullColor": true` to the shot. |

Duplicate a shot to add another beat. A change to an image, a cue or a line usually needs only the JSON. For a custom moment, **film.js** contains the three compositions and **lib/paper-kit.js** provides the original counters, stamps, marker strokes, tear holes and camera moves. Add a composition once when the story needs it, then reuse it.

## Storyboard, revise and export

For exports, install Python 3.10+, FFmpeg with libx264 on your PATH and these Python packages in your usual environment:

```sh
python -m pip install playwright pillow
python -m playwright install chromium
python make.py board
python make.py clip --start 2.1 --end 3.5
python make.py render
```

**board.png** contains a labelled still for every shot. **clip.mp4** contains the selected interval at 960×540 with audio if supplied. **render.mp4** is the full 1920×1080, 30 fps export. The commands replace the corresponding previous output. Use `--output another-name.mp4` or `--output another-board.png` to retain a version. You can run these commands without the preview server.

Review the board at a small size. Can you read the title, recognize the object and tell why it is there? Play the two most demanding transitions with audio. Check for a doubled face or word, a label hidden by the prop, and a cue arriving ahead of the voice. Name the shot, time and one desired change. Render that interval again. When the creator likes the result, export once and watch the whole film with sound. Local previews and exports use zero model tokens.

## Optional prompt for Claude

Open a fresh chat in the unzipped folder. Paste the following with your script, timings and asset filenames.

> I am making a 16:9 narrated paper-collage film. Read README.md and shots.json. My script, timed lines and available image filenames follow. Use my own wording, project facts and screenshots. Give me a shot list with the spoken cue, one prop and one on-screen idea per beat. Reuse the three existing layouts. Identify any missing image and suggest one distinctive moment worth custom animation. Work in one chat. Stop after the shot list so I can judge the story.
>
> Script and timings: [paste here]
>
> Assets: [list filenames and what each shows]
>
> What I want viewers to remember: [one sentence]

After review: “Apply my selected shots to shots.json. Keep the existing engine. Run the local storyboard command and show me the result.” For a revision: “At [time], in [shot], change [one thing]. Export [start] through [end] so I can judge it in motion.”

A practical first experiment is one planning turn, one implementation turn and one focused revision. That is a work budget you can choose, not a prediction of subscription usage. The sample demonstrates three reusable compositions. The 30-shot résumé also used bespoke sequences, including the WhatsApp reveal and identity montage.

