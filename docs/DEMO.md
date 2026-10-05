# Demo transcript

A real session, recorded on 2026-10-05 against `gemma4` served by Ollama on a laptop, no network. The recording is `demo.gif` (also `demo.cast`, playable with `asciinema play docs/demo.cast`). This file is the same session as text.

The repositories are Akash's. The answers were typed by the person running the demo. The first round is answered at a senior level on purpose; the second is answered vaguely on purpose, to show both ends of the grader.

## Commands

```
grill ingest AkashJana18/miccli AkashJana18/solana-consensus-lab
grill spots | head -8
grill start -n 2 --lang rust
grill forget AkashJana18/solana-consensus-lab
```

Ingest output:

```
AkashJana18/miccli  40 spots  unsafe 18, concurrency 11, ownership 5, shared-state 2, async 2, error-handling 2
AkashJana18/solana-consensus-lab  40 spots  ownership 6, numeric 6, lifetimes 6, error-handling 5, react-effects 5, async 4, event-loop 2, traits 1, this 1, iterators 1, macros 1, events 1, mutability 1

80 spots saved. Run `grill start`.
```

Top of `grill spots`:

```
 11  shared-state     AkashJana18/miccli src/audio.rs:62
  9  unsafe           AkashJana18/miccli src/main.rs:278
  8  concurrency      AkashJana18/miccli src/daemon.rs:324
  8  unsafe           AkashJana18/miccli src/overlay.rs:64
  7  shared-state     AkashJana18/miccli src/audio.rs:150
  7  concurrency      AkashJana18/miccli src/config.rs:297
  7  unsafe           AkashJana18/miccli src/daemon.rs:1326
  7  concurrency      AkashJana18/miccli src/config.rs:364
```

## Round 1 of 2: `AkashJana18/miccli src/daemon.rs:22`, topic `unsafe`

```rust
#[cfg(unix)]
fn is_process_alive(pid: i32) -> bool {
    unsafe { libc::kill(pid, 0) == 0 }
}
```

**Interviewer:** In `is_process_alive`, the `unsafe` block assumes that checking if `libc::kill(pid, 0)` equals `0` accurately reflects if the process is alive; what happens if this call returns -1 for reasons other than the process not existing, such as EPERM?

**Candidate:** The call cannot distinguish "no such process" from "exists but not mine". `kill(pid, 0)` returns -1 with ESRCH when the pid is gone and -1 with EPERM when the process exists but belongs to another user, so with `== 0` an EPERM case reads as dead. Here the function decides whether the pid in the pidfile is a live daemon, so a daemon started by another user, or by root, would look dead and a second instance would start on top of it.

The fix is to read errno after the call and treat EPERM as alive: `unsafe { libc::kill(pid, 0) } == 0 || io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)`. Only ESRCH means gone. The unsafe is justified because kill with signal 0 cannot hurt anything, it only runs the permission and existence checks.

The remaining hole is pid reuse: a stale pidfile whose pid was recycled by an unrelated process reads as alive, so the daemon refuses to start. The usual fix is to hold an flock on the pidfile instead and let the kernel release it on exit, which makes both problems go away.

**Interviewer (follow-up):** If the check using `is_process_alive` returns `true`, and the daemon subsequently enters a phase where it attempts to interact with the resource implied by the PID (e.g., signaling a specific state), what specific Time-of-Check to Time-of-Use (TOCTOU) race condition could occur if the monitored process terminates immediately after `is_process_alive` returns `true` but before the daemon acts?

**Candidate:** The race is between the `kill(pid, 0)` probe and whatever uses the pid next. If the old daemon exits in that window, the pid is free and the kernel can hand it to a new, unrelated process. A later `kill(pid, SIGTERM)` from `miccli stop` then signals a stranger, and a check that returned true made us refuse to start when in fact nothing was running. The probe answers "was alive a moment ago", never "is alive now".

You cannot close that gap with a pid alone. The honest fix is to stop using existence as the lock. Hold an exclusive flock on the pidfile for the daemon lifetime; the kernel drops it on any exit including SIGKILL, so a second instance tries the lock and either gets it or knows a live owner holds it, atomically. For signaling, use the lock as proof of ownership before sending anything. On Linux `pidfd_open` gives a handle that cannot be recycled, which is the stronger answer, but the flock is portable and small.

**Grade: 4/4.** The candidate demonstrated expert knowledge of OS process management, correctly identifying signal semantics and proposing solutions for both permission errors and PID reuse.

## Round 2 of 2: `AkashJana18/miccli src/overlay.rs:85`, topic `unsafe`

```rust
pub(super) struct WindowState {
    pub window: id,
    pub tf_top: id,
    pub tf_wave: id,
    pub tf_bottom: id,
}
unsafe impl Send for WindowState {}
unsafe impl Sync for WindowState {}

pub(super) static WINDOW: OnceLock<WindowState> = OnceLock::new();
```

**Interviewer:** When implementing `unsafe impl Send for WindowState {}`, what critical invariants must be guaranteed regarding the validity and lifetime of the `cocoa::base::id` members, and which surrounding code is responsible for upholding that invariant?

**Candidate:** I think it is fine because the window is only ever used from the main thread anyway. The id type is just a pointer, so marking it Send and Sync lets me put it in a static. The create_window function sets it up once so it is always valid after that.

**Interviewer (follow-up):** If `WindowState` is only ever used on the main thread, why is marking it `Send` necessary, and what specific issues might arise if another thread attempts to clone or move the `WindowState` object containing the `cocoa::base::id` members?

**Candidate:** The static needs Sync for OnceLock, and Send comes along with it. If another thread used the window it could crash, but nothing does that so it is okay.

**Grade: 1/4.** The candidate did not provide the specific invariants required for OS-bound pointers or properly explain the necessity of implementing Send/Sync for Cocoa-backed types.

Missed:

- The explicit invariant that the underlying Objective-C objects referenced by the IDs must maintain a valid lifetime.
- The mechanism by which the application's lifecycle management (e.g., ensuring proper memory retention) upholds this invariant.
- The specific violation that concurrent access to the OS objects via a secondary thread causes, which is typically violating Cocoa's thread affinity requirements.

Better: The primary invariant is that the underlying Cocoa objects referenced by `cocoa::base::id` must remain allocated and accessible throughout the state's lifetime, strictly adhering to the main thread requirement of AppKit. Upholding this responsibility falls to the application's object lifecycle management, ensuring objects are not prematurely released or deallocated. Implementing `Send` unsafely is necessary because moving the `WindowState` to a foreign thread immediately violates this thread affinity rule, causing undefined behavior or crashes from the underlying macOS runtime.

## The weak-spot map after the session

```
Weak spots, worst first

unsafe        ███░ 3.3  4 rounds
              · The explicit invariant that the underlying Objective-C objects referenced by the IDs must maintain a valid lifetime.
              · The mechanism by which the application's lifecycle management (e.g., ensuring proper memory retention) upholds this invariant.
              · The specific violation that concurrent access to the OS objects via a secondary thread causes, which is typically violating Cocoa's thread affinity requirements.
shared-state  ████ 4.0  1 round
```

The `unsafe` line averages two earlier rounds from the same day with the two above. The next `grill start` draws more from `unsafe` because it is the weakest topic.

## Cleanup

```
grill forget AkashJana18/solana-consensus-lab
AkashJana18/solana-consensus-lab  40 spots dropped
```

## How it was recorded

```sh
uvx asciinema rec --cols 100 --rows 42 -i 2.5 -c bash docs/demo.cast
agg --cols 100 --rows 42 --font-size 14 --idle-time-limit 2 --last-frame-duration 6 docs/demo.cast docs/demo.gif
```

Model thinking time is capped at 2.5 seconds in playback. Real waits on this laptop were 10 to 40 seconds per model call.
