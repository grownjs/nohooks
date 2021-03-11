const contextStack = [];

function getContext() {
  const scope = contextStack[contextStack.length - 1];

  if (!scope) {
    throw new Error('Cannot invoke hooks outside createContext()');
  }
  return scope;
}

function pop(scope) {
  contextStack[contextStack.indexOf(scope)] = null;
}

function push(scope) {
  contextStack.push(scope);
}

function isObj(value) {
  return value !== null && typeof value === 'object';
}

function undef(value) {
  return typeof value === 'undefined' || value === null;
}

function clone(value) {
  if (!value || !isObj(value)) return value;
  if (Array.isArray(value)) return value.map(x => clone(x));
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
}

function equals(a, b) {
  if (typeof a !== typeof b) return;
  if (a instanceof Array) {
    if (a.length !== b.length) return;
    for (let i = 0; i < a.length; i += 1) {
      if (!equals(a[i], b[i])) return;
    }
    return true;
  }
  if (a && b && a.constructor === Object) {
    const x = Object.keys(a).sort();
    if (!equals(x, Object.keys(b).sort())) return;
    for (let i = 0; i < x.length; i += 1) {
      if (!equals(a[x[i]], b[x[i]])) return;
    }
    return true;
  }
  return a === b;
}

function createContext(render, callback = fn => fn()) {
  if (typeof render !== 'function' || typeof callback !== 'function') {
    throw new TypeError('Invalid input for createContext()');
  }

  return (...args) => {
    const scope = { c: 0 };

    function end(skip) {
      try {
        scope.get.forEach(fx => {
          if (fx.off) fx.off();
          if (!skip && fx.on && fx.cb) {
            const retval = fx.cb();

            if (typeof retval === 'function') {
              fx.off = retval;
            }
            fx.on = false;
          }
        });
      } catch (e) {
        return Promise.reject(e);
      }
    }

    let deferred;
    function next(promise) {
      promise.catch(e => {
        if (scope.get) setTimeout(() => end(true));
        if (scope.onError) {
          scope.onError(e);
        } else {
          throw e;
        }
      }).then(() => {
        deferred = null;
      });
    }

    function after() {
      if (scope.get) next(Promise.resolve(end()));
    }

    scope.sync = () => {
      deferred = next(scope.set());
      return deferred;
    };

    return callback(() => {
      ;(function loop() { // eslint-disable-line
        scope.set = scope.set || (() => Promise.resolve().then(() => {
          if (!equals(scope.val, scope.old)) loop();
        }));

        scope.old = clone(scope.val);
        scope.key = 0;
        scope.fx = 0;
        scope.m = 0;
        scope.c += 1;

        push(scope);

        try {
          scope.result = render(...args);

          const key = [scope.key, scope.fx, scope.m].join('.');

          if (!scope.hash) {
            scope.hash = key;
          } else if (scope.hash !== key) {
            throw new Error('Hooks must be called in a predictable way');
          }
          return scope.result;
        } catch (e) {
          throw new Error(`Unexpected failure in context\n${e.message}`);
        } finally {
          pop(scope);
          after();
        }
      })();

      scope.defer = ms => Promise.resolve()
        .then(() => new Promise(ok => setTimeout(() => ok(scope), ms)));

      return scope;
    }, sync => { scope.set = sync; });
  };
}

function onError(callback) {
  getContext().onError = callback;
}

function useMemo(callback, inputs) {
  const scope = getContext();
  const key = scope.m;

  scope.m += 1;
  scope.v = scope.v || [];
  scope.d = scope.d || [];

  const prev = scope.d[key];

  if (undef(prev) || !equals(prev, inputs)) {
    scope.v[key] = callback();
    scope.d[key] = inputs;
  }
  return scope.v[key];
}

function useRef(result) {
  return useMemo(() => {
    let value = clone(result);

    return Object.defineProperty({}, 'current', {
      configurable: false,
      enumerable: true,
      set: ref => { value = ref; },
      get: () => value,
    });
  }, []);
}

function useState(fallback) {
  const scope = getContext();
  const key = scope.key;

  scope.key += 1;
  scope.val = scope.val || [];

  if (undef(scope.val[key])) {
    scope.val[key] = fallback;
  }

  return [scope.val[key], v => {
    scope.val[key] = v;
    scope.sync();
  }];
}

function useEffect(callback, inputs) {
  const scope = getContext();
  const key = scope.fx;

  scope.fx += 1;
  scope.in = scope.in || [];
  scope.get = scope.get || [];

  const prev = scope.in[key];
  const enabled = inputs ? !equals(prev, inputs) : true;

  scope.in[key] = inputs;
  scope.get[key] = scope.get[key] || {};

  Object.assign(scope.get[key], { cb: callback, on: enabled });
}

module.exports = {
  clone,
  equals,
  getContext,
  createContext,
  onError,
  useMemo,
  useRef,
  useState,
  useEffect,
};
