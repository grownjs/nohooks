# nohooks

> Compose reactive hooks without additional libraries.

## Installation

```bash
$ npm i nohooks --save
```

## How it works?

The `nohooks` library provides a single module with several low-level hooks, e.g.

```js
import { createContext, useState } from 'nohooks';

async function main() {
  const scope = createContext(() => {
    const [value, setValue] = useState(3);
    if (value > 0) setValue(value - 1);
    console.log(value);
    return value;
  })();

  console.log(scope.result === 3);
  await scope.defer();
  console.log(scope.result === 0);
}
main();
```

<details>
  <summary>Output</summary>
  <pre>3
true
2
1
0
true</pre>
</details>

> Notice `scope.result` returns the initial value immediately, after waiting it returns the last computed value.

### Available hooks

- `onError(cb)` &mdash; Capture unhandled exceptions.
- `useMemo(cb[, deps])` &mdash; Memoized callback result.
- `useEffect(cb[, deps])` &mdash; Fires a synchronous callback.
- `useRef([defaultValue])` &mdash; Returns a persistent unique reference.
- `useState([defaultValue])` &mdash; Returns a value/setter from the any given value.

> Notice that no passing `deps` will trigger the given callback on every iteration, use `[]` to fire it once.

### Other utilities

- `clone(obj)` &mdash; Returns a copy from any given value.
- `equals(a, b)` &mdash; Returns `true` if `a` and `b` are equal.
