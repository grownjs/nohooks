/* eslint-disable no-unused-expressions */

const td = require('testdouble');
const { expect } = require('chai');

const {
  clone,
  equals,
  onError,
  useMemo,
  useRef,
  useState,
  useEffect,
  getContext,
  createContext,
} = require('..');

/* global beforeEach, describe, it */

const values = {
  foo: 'bar',
  baz: {
    re: /regex/,
    now: new Date(),
    buzz: ['BAZZINGA'],
  },
};

describe('clone()', () => {
  it('should clone most types', () => {
    expect(values).to.eql(clone(values));
  });
});

describe('equals()', () => {
  it('should compare most values', () => {
    expect(equals(values, values)).to.be.true;
    expect(equals([], [1])).not.to.be.true;
    expect(equals(values, {
      foo: 'BAR',
      baz: {
        re: /nope/,
        new: new Date(1),
        buzz: ['BAZZINGA', '!'],
      },
    })).not.to.be.true;
  });
});

describe('createContext()', () => {
  it('should validate given arguments', () => {
    expect(createContext).to.throw(/Invalid input for createContext/);
  });

  it('should allow to pass a refreshCallback', () => {
    const callback = td.func('sync');
    const render = td.func('tag');

    td.when(callback(td.matchers.isA(Function), td.matchers.isA(Function)))
      .thenDo((fn, set) => [fn(), set()]);

    createContext(render, callback)();

    expect(td.explain(render).callCount).to.eql(1);
    expect(td.explain(callback).callCount).to.eql(1);
  });

  it('should allow to clear out context effects', async () => {
    const fn = td.func('clearTimeout');

    let t;
    const scope = createContext(() => {
      const [v, s] = useState(0);

      useEffect(() => {
        t = setTimeout(() => {
          s(v + 1);
        }, 100);
        return () => fn(t);
      }, [v]);
      return v;
    })();

    await scope.defer(50);
    scope.clear();

    expect(scope.result).to.eql(0);
    expect(td.explain(fn).callCount).to.eql(1);
  });
});

describe('getContext()', () => {
  it('should fail outside createContext()', () => {
    expect(getContext).to.throw(/Cannot invoke hooks outside createContext/);
  });
});

describe('useMemo()', () => {
  it('should return same value on unchanged deps', async () => {
    const callback = td.func('truth');

    td.when(callback())
      .thenReturn(42);

    const scope = createContext(() => {
      const test = useMemo(callback, []);
      const [value, setValue] = useState(42);

      if (value === 42) setValue(value / 2);
      return test * value;
    })();

    await scope.defer();
    expect(scope.result).to.eql(882);
    expect(td.explain(callback).callCount).to.eql(1);
  });
});

describe('useRef()', () => {
  it('should allow to capture references', async () => {
    const refs = [];

    createContext(() => {
      const ref = useRef();

      refs.push(ref, useRef(-1));
      ref.current = 42;
    })();

    expect(refs).to.eql([{ current: 42 }, { current: -1 }]);
  });
});

describe('useState()', () => {
  it('should allow to update state values', async () => {
    const scope = createContext(() => {
      const [value, setValue] = useState(42);

      if (value === 21) setValue('OSOM');
      if (value === 42) setValue(value / 2);

      return value;
    })();

    await scope.defer();
    expect(scope.result).to.eql('OSOM');
  });

  it('should allow callbacks as setters', async () => {
    const scope = createContext(() => {
      const [value, setValue] = useState(0);
      useEffect(() => {
        const t = setInterval(() => {
          setValue(x => x + 1);
        }, 100);
        return () => clearInterval(t);
      });
      return value;
    })();

    await scope.defer(250);
    scope.clear();

    expect(scope.result).to.eql(2);
  });

  it('should run updates in sequence', async () => {
    const stack = [];

    function a(x) {
      return createContext(() => {
        const [v, s] = useState(0);

        if (v < 3) s(v + 1);

        stack.push({ x, v });
        return v;
      })().defer();
    }

    const x = await a(1);
    const y = await a(2);
    const z = await a(3);

    expect(x.result).to.eql(3);
    expect(y.result).to.eql(3);
    expect(z.result).to.eql(3);
    expect(stack).to.eql([
      { x: 1, v: 0 },
      { x: 1, v: 1 },
      { x: 1, v: 2 },
      { x: 1, v: 3 },
      { x: 2, v: 0 },
      { x: 2, v: 1 },
      { x: 2, v: 2 },
      { x: 2, v: 3 },
      { x: 3, v: 0 },
      { x: 3, v: 1 },
      { x: 3, v: 2 },
      { x: 3, v: 3 },
    ]);
  });

  it('should rerun on every change', async () => {
    function a() {
      return createContext(() => {
        const [v, s] = useState(-1);

        if (v < 3) {
          s(0);
          s(1);
          s(2);
          s(3);
        }
        return v;
      })();
    }
    const x = await a();

    expect(x.result).to.eql(3);
    expect(x.c).to.eql(2);
  });
});

describe('useEffect()', () => {
  it('should allow to trigger effects after render', async () => {
    const callback = td.func('fx');
    const effect = td.func('fx');

    td.when(effect()).thenReturn(callback);

    const scope = createContext(() => {
      const [value, setValue] = useState(5);

      if (value > 1) setValue(value - 1);
      useEffect(effect);
      return 'OSOM';
    })();

    await scope.defer();
    expect(scope.result).to.eql('OSOM');
    expect(td.explain(effect).callCount).to.eql(1);
    expect(td.explain(callback).callCount).to.eql(0);

    scope.clear();
    expect(td.explain(effect).callCount).to.eql(1);
    expect(td.explain(callback).callCount).to.eql(1);
  });

  it('should skip callback if the input does not change', async () => {
    const callback = td.func('cb');
    const effect = td.func('fx');

    td.when(effect()).thenReturn(callback);

    const scope = createContext(() => {
      const [value, setValue] = useState(5);

      if (value > 1) setValue(value - 1);
      useEffect(effect, []);
      return value;
    })();

    await scope.defer();
    expect(scope.result).to.eql(1);
    expect(td.explain(effect).callCount).to.eql(1);
    expect(td.explain(callback).callCount).to.eql(0);

    scope.clear();
    expect(scope.result).to.eql(1);
    expect(td.explain(effect).callCount).to.eql(1);
    expect(td.explain(callback).callCount).to.eql(1);
  });

  it('should trigger teardown callbacks if input changes', async () => {
    const teardown = td.func('end');
    const callback = td.func('fx');

    td.when(callback())
      .thenReturn(teardown);

    const scope = createContext(() => {
      const [value, setValue] = useState(3);

      if (value > 0) setValue(value - 1);
      useEffect(callback, [value]);
      return value;
    })();

    await scope.defer();
    expect(scope.c).to.eql(4);
    expect(scope.result).to.eql(0);
    expect(td.explain(teardown).callCount).to.eql(3);
    expect(td.explain(callback).callCount).to.eql(4);
  });
});

describe('onError()', () => {
  let error;
  beforeEach(() => {
    error = null;
  });

  it('should help to capture failures', async () => {
    const scope = createContext(() => {
      const [value, setValue] = useState(42);

      onError(e => {
        error = e;
      });

      if (value === 21) useState(-1);
      if (value === 42) setValue(value / 2);

      return value;
    })();

    await scope.defer();
    expect(error.message).to.contains('Hooks must be called in a predictable way');
  });

  it('should raise unhandledRejection otherwise', async () => {
    function callback(e) {
      error = e;
    }

    const scope = createContext(() => {
      useEffect(() => {
        process.on('unhandledRejection', callback);
        return () => {
          process.off('unhandledRejection', callback);
        };
      });

      useEffect(() => {
        throw new Error('WAT');
      });

      return 42;
    })();

    await scope.defer(10);
    expect(scope.result).to.eql(42);
    expect(error.message).to.eql('WAT');
  });
});
