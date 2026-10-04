import type { Lang } from "../types.js";

export interface Pattern {
  tag: string;
  topic: string;
  lang: Lang;
  re: RegExp;
  /** How much this pattern makes a spot worth asking about. */
  weight: number;
  /** What a good interviewer would probe here. */
  angle: string;
}

const rust = (tag: string, topic: string, re: RegExp, weight: number, angle: string): Pattern => ({
  tag,
  topic,
  lang: "rust",
  re,
  weight,
  angle,
});

const js = (tag: string, topic: string, re: RegExp, weight: number, angle: string): Pattern => ({
  tag,
  topic,
  lang: "js",
  re,
  weight,
  angle,
});

export const PATTERNS: Pattern[] = [
  // Rust
  rust("unsafe", "unsafe", /\bunsafe\s*(\{|fn\b|impl\b)/, 5, "which invariant the unsafe block relies on and who upholds it"),
  rust("transmute", "unsafe", /\b(transmute|MaybeUninit|ManuallyDrop|from_raw_parts|from_raw)\b/, 5, "what makes this sound and what undefined behaviour it risks"),
  rust("shared-state", "shared-state", /\b(Arc<\s*(Mutex|RwLock)|Rc<\s*RefCell|Arc::new\(\s*(Mutex|RwLock))/, 4, "why shared mutable state was chosen over message passing or ownership transfer"),
  rust("lock", "concurrency", /\.(lock|read|write)\(\)\s*(\.await|\.unwrap\(\)|\?)/, 4, "how long the guard lives, whether it is held across an await, and what a poisoned or contended lock does"),
  rust("spawn", "concurrency", /\b(tokio::spawn|tokio::task::spawn_blocking|thread::spawn|spawn_blocking)\b/, 4, "what happens to the task on panic or shutdown and why the captured data is Send + 'static"),
  rust("channel", "concurrency", /\b(mpsc|oneshot|broadcast|watch)::|\bchannel\(/, 3, "backpressure, what a full or closed channel does, and why this channel type"),
  rust("lifetime", "lifetimes", /<'(?!static\b)[a-z]\w*|&'(?!static\b)[a-z]\w*\s/, 4, "what the lifetime ties together and what the compiler would reject without it"),
  rust("pin-future", "async", /\b(Pin<|impl\s+Future|dyn\s+Future|fn\s+poll\b|select!)/, 4, "why pinning or manual polling is needed here and what cancellation does"),
  rust("async-fn", "async", /\basync\s+(fn|move|\{)/, 2, "what runs concurrently, where this future can be cancelled, and whether anything blocks the executor"),
  rust("dyn-trait", "traits", /\b(Box<\s*dyn|&\s*dyn|&mut\s+dyn|Arc<\s*dyn|Rc<\s*dyn|->\s*impl\s+\w+|:\s*impl\s+\w+)/, 3, "static versus dynamic dispatch and why this one was chosen"),
  rust("drop", "ownership", /\bimpl(<[^>]*>)?\s+Drop\s+for\b/, 4, "what must be released, drop order, and what happens on panic"),
  rust("clone", "ownership", /\.clone\(\)|\bCow<|\bmem::(take|replace|swap)\b/, 2, "whether the copy or move is needed or a borrow would do, and what it costs"),
  rust("unwrap", "error-handling", /\.(unwrap|expect)\(/, 2, "when this panics in production and what the caller should get instead"),
  rust("error-map", "error-handling", /\b(map_err|anyhow!|bail!|thiserror|Box<\s*dyn\s+(std::error::)?Error)/, 2, "what context is lost or kept and how a caller can match on this error"),
  rust("cast", "numeric", /\bas\s+(u8|u16|u32|u64|usize|i8|i16|i32|i64|isize|f32|f64)\b/, 2, "what happens on overflow, truncation, or a negative value"),
  rust("macro", "macros", /\bmacro_rules!|#\[proc_macro/, 3, "why a macro instead of a function or generic, and what hygiene issues it has"),
  rust("iter-collect", "iterators", /\.collect::<|\.into_iter\(\)|\.iter\(\)\.\w+\(/, 1, "allocations in this chain and whether it stays lazy"),

  // JavaScript and TypeScript
  js("async-in-loop", "async", /\.(forEach|map|filter|reduce)\(\s*async\b/, 5, "what actually awaits here, the order of completion, and how errors surface"),
  js("promise-combinator", "async", /\bPromise\.(all|allSettled|race|any)\b/, 4, "what happens when one promise rejects and whether the others keep running"),
  js("new-promise", "async", /\bnew\s+Promise\s*[<(]/, 3, "why a manual promise is needed and what happens if resolve is never called"),
  js("timer", "event-loop", /\b(setTimeout|setInterval|requestAnimationFrame|queueMicrotask|setImmediate)\s*\(/, 3, "where this lands in the event loop, cleanup, and what a stale closure sees"),
  js("debounce", "event-loop", /\b(debounce|throttle)\b/, 3, "trailing versus leading calls and what happens on unmount"),
  js("effect", "react-effects", /\buse(Effect|LayoutEffect)\s*\(/, 3, "the dependency array, the cleanup function, and what runs twice in strict mode"),
  js("memo", "react-rendering", /\buse(Memo|Callback|Ref)\s*[<(]|\bReact\.memo\b/, 2, "what re-render this prevents and whether the dependencies make it pointless"),
  js("listener", "events", /\.addEventListener\s*\(/, 3, "who removes the listener and what leaks if nobody does"),
  js("socket", "events", /\bnew\s+(WebSocket|EventSource)\b/, 3, "reconnection, ordering, and what happens to in-flight messages"),
  js("any", "types", /:\s*any\b|\bas\s+any\b|<any>/, 3, "what the type should be and what bug the any hides"),
  js("double-cast", "types", /\bas\s+unknown\s+as\b/, 4, "why the compiler had to be overruled and how to prove the shape at runtime"),
  js("non-null", "types", /\w[)\]]?!\.|\w!;|\w!\)/, 2, "when this is null at runtime and what the user sees"),
  js("generic", "types", /\bfunction\s+\w+\s*<\s*\w+|<\s*T\s+extends\b|\binfer\s+\w+/, 3, "what the constraint buys and how inference picks the type"),
  js("empty-catch", "error-handling", /\bcatch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/, 4, "which failures are swallowed and how anyone would find out"),
  js("json-parse", "error-handling", /\bJSON\.parse\s*\(/, 2, "what malformed input does here and how the shape is validated"),
  js("loose-equality", "coercion", /[^=!<>]==[^=]|[^=!]!=[^=]/, 2, "which coercion rules apply and one input that gives a surprising result"),
  js("this-binding", "this", /\.bind\(\s*this\s*\)|\.call\(|\.apply\(/, 3, "what this is at call time and how an arrow function would change it"),
  js("deep-copy", "mutability", /\bstructuredClone\(|JSON\.parse\(\s*JSON\.stringify|Object\.assign\(|Object\.freeze\(/, 3, "shallow versus deep copy and what is still shared afterwards"),
  js("fetch", "network", /\bfetch\s*\(|\baxios\.\w+\(/, 2, "non-2xx responses, timeouts, aborts, and races between two calls"),
  js("reduce", "arrays", /\.reduce\s*\(/, 2, "the accumulator's type, the empty-array case, and complexity"),
  js("stream-gen", "iterators", /\bfunction\s*\*|\bfor\s+await\b|\bAsyncGenerator\b|\bReadableStream\b/, 4, "who pulls, what backpressure exists, and how it is cancelled"),
];

const EXTENSIONS: Record<string, Lang> = {
  ".rs": "rust",
  ".ts": "js",
  ".tsx": "js",
  ".js": "js",
  ".jsx": "js",
  ".mjs": "js",
  ".cjs": "js",
};

export function langOf(file: string): Lang | undefined {
  const dot = file.lastIndexOf(".");
  if (dot < 0) return undefined;
  if (file.endsWith(".d.ts") || file.endsWith(".min.js")) return undefined;
  return EXTENSIONS[file.slice(dot)];
}
