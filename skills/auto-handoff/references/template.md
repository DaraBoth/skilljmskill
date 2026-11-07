# Handoff: <role>, <YYYY-MM-DD>

You are the new **<role>** session. The previous session (<tab or terminal title>, transcript
`<absolute path to its .jsonl or rollout file>`, <size> MB; grep it for specifics, do not read it
whole) stops after this handoff. You own the work now.

Read your memory index first if you have one. Most standing rules live there. This file adds the
state that memory does not hold.

## Who and how

- Who the user is for this work, in one line, and how they want replies (length, language, format).
- How to reach the other sessions you work with (tool or command, and their role names).
- Anything about tone or process the user corrected in this session and memory does not hold yet.

## Standing constraints (verbatim from the user, still in force)

- "<exact quote>"
- "<exact quote>"
- Plain-words rules that follow from them (never read X, never push Y, never touch Z).

## <Project or repo 1> (<absolute path>, remote <owner/repo>)

- Branch checked out, HEAD hash, ahead/behind vs remote.
- What landed this session: commit hashes with one line each, PR numbers, CI run ids.
- Uncommitted or stashed files, and for each: leave alone, or what to do.
- Running services, background jobs, loops or schedules this session started (they stop with it).
- Known cause of any open bug, with the evidence path.

## <Project or repo 2>

- Same shape.

## Waiting on the user

1. <What the user still has to do>, and what you do right after it.

## Open decisions (ask, do not decide)

- <Question>, with the option facts the user needs.

## Recurring duties

- Reports, digests, scheduled checks: what is done, what is next, where the template lives.

## First thing to do

<One action. Usually: tell the user in one or two lines that you have taken over, then wait.
For a loop agent: restart its loop with the exact command, for example `/loop /work <role> <name>`.>
