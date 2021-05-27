const { max } = Math;
const { isArray, from: arrayFrom } = Array;

declare const STORAGE_SOURCE: unique symbol;
declare const CACHE_SOURCE: unique symbol;

export interface CacheSource<T = unknown> {
  [CACHE_SOURCE]: T;
}

export interface StorageSource<T = unknown> {
  [STORAGE_SOURCE]: T;
}

export type Source<T = unknown> = CacheSource<T> | StorageSource<T>;

//////////

export type Revision = number;

const enum Revisions {
  INITIAL = 1,
  CONSTANT = 0,
  UNINITIALIZED = -1,
}

let $REVISION = Revisions.INITIAL;

//////////

export class SourceImpl<T = unknown> implements StorageSource<T>, CacheSource<T> {
  declare [STORAGE_SOURCE]: T;
  declare [CACHE_SOURCE]: T;

      // The goal here is that with a new Cache
    //   1. isConst(cache) === false
    //   2. isDirty(cache) === true
    //   3. if the cache is evaluated once, and has no dependencies or only
    //      constant dependencies, it becomes `isConst` true
  public revision: Revision = Revisions.INITIAL;
  public valueRevision: Revision = Revisions.UNINITIALIZED;

  constructor(
    public value: T | undefined,
    public isEqual: ((oldValue: T, newValue: T) => boolean) | null,
    public compute: (() => T) | null,
  ) {}

  lastChecked = Revisions.UNINITIALIZED;

  deps: SourceImpl<unknown> | SourceImpl<unknown>[] | null = null;
}

export function isSourceImpl<T>(cache: Source<T> | unknown): cache is SourceImpl<T> {
  return cache instanceof SourceImpl;
}

function getRevision<T>(cache: SourceImpl<T>): Revision {
  let { lastChecked, revision: originalRevision } = cache;
  let revision = originalRevision;

  if (lastChecked !== $REVISION) {
    cache.lastChecked = $REVISION;

    let { deps } = cache;

    if (deps !== null) {
      if (isArray(deps)) {
        for (let i = 0; i < deps.length; i++) {
          revision = max(revision, getRevision(deps[i]));
        }
      } else {
        revision = max(revision, getRevision(deps));
      }

      if (cache.valueRevision !== revision) {
        cache.revision = revision;
      } else {
        // If the last revision for the current value is equal to the current
        // revision, nothing has changed in our sub dependencies and so we
        // should return our last revision. See `addDeps` below for more
        // details.
        revision = originalRevision;
      }
    }
  }

  return revision;
}

function tripleEq(oldValue: unknown, newValue: unknown) {
  return oldValue === newValue;
}

export function createStorage<T>(
  initialValue: T,
  isEqual: (oldValue: T, newValue: T) => boolean = tripleEq
): StorageSource<T> {
  return new SourceImpl(initialValue, isEqual, null);
}

export function createCache<T>(compute: () => T): CacheSource<T> {
  return new SourceImpl<T>(undefined, null, compute);
}

////////

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new Error(message);
  }
}

function isDirty<T>(source: Source<T>): boolean {
  assert(
    isSourceImpl(source),
    `isConst() can only be used on an instance of a cache created with createCache() or a storage created with createStorage(). Called with: ${source}`
  );

  return getRevision(source) > source.valueRevision;
}

export function isConst<T>(source: Source<T>): boolean {
  assert(
    isSourceImpl(source),
    `isConst() can only be used on an instance of a cache created with createCache() or a storage created with createStorage(). Called with: ${source}`
  );

  return source.valueRevision === Revisions.CONSTANT;
}

////////

/**
 * An object that that tracks @tracked properties that were consumed.
 */
 class Tracker {
  private caches = new Set<SourceImpl<unknown>>();
  private last: SourceImpl<unknown> | null = null;

  maxRevision: number = Revisions.CONSTANT;

  add<T>(_cache: SourceImpl<T>) {
    let cache = _cache as SourceImpl<unknown>;

    if (isConst(cache)) return;

    this.caches.add(cache);
    this.maxRevision = max(this.maxRevision, getRevision(cache));
    this.last = cache as SourceImpl<unknown>;
  }

  toDeps(): SourceImpl<unknown> | SourceImpl<unknown>[] | null {
    let { caches } = this;

    if (caches.size === 0) {
      return null;
    } else if (caches.size === 1) {
      return this.last;
    } else {
      return arrayFrom(caches);
    }
  }
}

/**
 * Whenever a cache source is entered, the current tracker is saved off and a
 * new tracker is replaced.
 *
 * Any sources consumed are added to the current tracker.
 *
 * When a cache source is exited, the tracker's tags are combined and added to
 * the parent tracker.
 *
 * The consequence is that each cache source has dependencies that corresponds
 * to the sources consumed inside of itself, including child cache sources.
 */
let CURRENT_TRACKER: Tracker | null = null;

let OPEN_CACHES: (Tracker | null)[] = [];

export function getValue<T>(source: Source<T>): T {
  assert(
    isSourceImpl<T>(source),
    `getValue() can only be used on an instance of a cache created with createCache() or a storage created with createStorage(). Called with: ${source}`
  );

  if (isConst(source)) {
    return source.value;
  }

  let { compute } = source;

  if (compute !== null && isDirty(source)) {
    OPEN_CACHES.push(CURRENT_TRACKER);
    CURRENT_TRACKER = new Tracker();

    try {
      source.value = compute();
    } finally {
      source.deps = CURRENT_TRACKER.toDeps();
      source.valueRevision = source.revision = CURRENT_TRACKER.maxRevision;
      source.lastChecked = $REVISION;

      CURRENT_TRACKER = OPEN_CACHES.pop() || null;
    }
  }

  if (CURRENT_TRACKER !== null) {
    CURRENT_TRACKER.add(source);
  }

  return source.value;
}

////////

let revalidate: () => void;

export function setRevalidate(fn) {
  revalidate = fn;
}

type SourceValue<T extends Source<unknown>> = T extends Source<infer U> ? U : never;

export function setValue<T extends Source<unknown>>(storage: T, value: SourceValue<T>): void {
  assert(isSourceImpl(storage), 'isConst was passed a value that was not a cache or storage');
  assert(storage.compute === null, 'Attempted to setValue on a non-settable cache');

  let { value: oldValue, isEqual } = storage;

  assert(typeof isEqual === 'function', 'Attempted to set a storage without `isEqual`');

  if (isEqual(oldValue, value) === false) {
    storage.value = value;
    storage.revision = storage.valueRevision = ++$REVISION;
    revalidate();
  }
}
