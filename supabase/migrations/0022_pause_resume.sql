-- Teacher-controlled pause/resume for a live Team Battle round. 'paused' sits
-- alongside 'question' in the status lifecycle (lobby -> question <-> paused
-- -> ... -> final); the host toggles between 'question' and 'paused' for the
-- same current_question_index, so no other columns change and no timer state
-- needs to be persisted here — see app/games/play/[id]/TeamBattleHost.tsx and
-- app/student/play/[sessionId]/TeamBattlePlayer.tsx.
alter type public.session_status add value if not exists 'paused';
