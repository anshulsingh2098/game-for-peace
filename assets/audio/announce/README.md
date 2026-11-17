# Real station announcements (owner-supplied, pending legal review)

Put the recordings here with a `manifest.json` (see `manifest.example.json`). The audio files are git-ignored (`*.mp3`, `*.m4a`, `*.wav` are ignored outside `assets/audio/`'s own loops); `manifest.json` is plain data and is tracked only if you want to share the mapping.

Source the owner named: the YouTube playlist https://www.youtube.com/playlist?list=PL7nUR0WB6kMBPrzFzIpF8IQ5vbdOF36WX (real Indian station announcements, by city and language). The game's tools do not download from YouTube; the owner obtains the files. Each manifest entry names the uploader and URL so `tools/build_licenses.mjs` can list them in `licenses.html` as "pending legal review". Nothing here may be deployed until the owner's lawyer has cleared it.

Quick import: `node tools/import_announcements.mjs <folder of downloaded files>` copies them here and writes a first manifest from the file names (`city_kind_lang[_trainnumber]`, for example `mumbai_arriving_mr_12951.mp3`, `pune_welcome_hi.mp3`); edit `manifest.json` to fix guesses and add `credit` and `url`.
