import { createStorage, getValue, setValue } from "./primitives";

const ARRAY_GETTER_METHODS = new Set<string | symbol | number>([
  Symbol.iterator,
  'concat',
  'entries',
  'every',
  'fill',
  'filter',
  'find',
  'findIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'values',
]);

function convertToInt(prop: number | string | symbol): number | null {
  if (typeof prop === 'symbol') return null;

  const num = Number(prop);

  if (isNaN(num)) return null;

  return num % 1 === 0 ? num : null;
}

class TrackedArrayProxyHandler {
  storage = createStorage(null, () => false);
  boundFns = new Map();

  get(target: any, prop: any) {
    let index = convertToInt(prop);

    if (index !== null) {
      getValue(this.storage);

      return target[index];
    } else if (prop === 'length') {
      getValue(this.storage);
    } else if (ARRAY_GETTER_METHODS.has(prop)) {
      let { boundFns } = this;

      let fn = boundFns.get(prop);

      if (fn === undefined) {
        fn = (...args: unknown[]) => {
          getValue(this.storage);
          return (target as any)[prop](...args);
        };

        boundFns.set(prop, fn);
      }

      return fn;
    }

    return target[prop];
  }

  set(target: any, prop: any, value: any) {
    target[prop] = value;

    setValue(this.storage, null);

    return true;
  }

  getPrototypeOf() {
    return TrackedArray.prototype;
  }
}

function createArrayProxy<T>(arr: T[]): TrackedArray<T> {
  return new Proxy(arr, new TrackedArrayProxyHandler());
}

class TrackedArray<T = unknown> {
  /**
   * Creates an array from an iterable object.
   * @param iterable An iterable object to convert to an array.
   */
  static from<T>(iterable: Iterable<T> | ArrayLike<T>): TrackedArray<T>;

  /**
   * Creates an array from an iterable object.
   * @param iterable An iterable object to convert to an array.
   * @param mapfn A mapping function to call on every element of the array.
   * @param thisArg Value of 'this' used to invoke the mapfn.
   */
  static from<T, U>(
    iterable: Iterable<T> | ArrayLike<T>,
    mapfn: (v: T, k: number) => U,
    thisArg?: unknown
  ): TrackedArray<U>;

  static from<T, U>(
    iterable: Iterable<T> | ArrayLike<T>,
    mapfn?: (v: T, k: number) => U,
    thisArg?: unknown
  ): TrackedArray<T> | TrackedArray<U> {
    return mapfn
      ? createArrayProxy(Array.from(iterable, mapfn, thisArg))
      : createArrayProxy(Array.from(iterable));
  }

  static of<T>(...arr: T[]): TrackedArray<T> {
    return createArrayProxy(arr);
  }

  constructor(arr: T[] = []) {
    return createArrayProxy(arr.slice());
  }
}

// This rule is correctly in the general case, but it doesn't understand
// declaration merging, which is how we're using the interface here. This
// declaration says that `TrackedArray` acts just like `Array<T>`, but also has
// the properties declared via the `class` declaration above -- but without the
// cost of a subclass, which is much slower that the proxied array behavior.
// That is: a `TrackedArray` *is* an `Array`, just with a proxy in front of
// accessors and setters, rather than a subclass of an `Array` which would be
// de-optimized by the browsers.
//
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TrackedArray<T = unknown> extends Array<T> {}

export default TrackedArray;

// Ensure instanceof works correctly
Object.setPrototypeOf(TrackedArray.prototype, Array.prototype);
