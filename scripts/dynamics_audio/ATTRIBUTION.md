Dynamics audio clips used by `scripts/create_dynamics_game.mjs`.

All 10 clips are built from real violin recordings — University of Iowa
Musical Instrument Samples (theremin.music.uiowa.edu), public domain
("freely available ... and may be downloaded and used for any projects,
without restrictions").

Source files (arco, sul A string, A4-B4):
- Violin.arco.pp.sulA.A4B4.aiff
- Violin.arco.mf.sulA.A4B4.aiff
- Violin.arco.ff.sulA.A4B4.aiff
https://theremin.music.uiowa.edu/MISviolin.html

Why the gain is adjusted: these three recordings were made without changing
the input gain between dynamic levels, so their *relative* loudness is a
real, physical pp→mf→ff relationship — not something normalized away like
the other games' clips. To get all 8 named levels (ppp–fff) plus
crescendo/decrescendo, each clip's gain is set to a calibrated target (a
clean 4dB step per level, anchored close to the real pp/mf/ff
measurements) rather than reusing one flat loudness for everything. The
instrument recording itself is real and unprocessed aside from that gain
change; crescendo/decrescendo apply a linear ramp across the same real
note (an actual gradual level change, not two static levels).
