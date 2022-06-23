/**
 * extremum-resolution-store
 * -------------------------
 * This specialized store handles the resolution of plot bounds based
 * on multiple extrema. If multiple components set a maximum value within
 * the same namespace, the store will automatically pick the largest
 * for the store value. This enables us to determine, for instance, if
 * multiple lines are on the same chart, which ones determine the bounds.
 */
import { cubicOut } from "svelte/easing";
import { writable, derived, Writable } from "svelte/store";
import { tweened } from "svelte/motion";
import { min, max } from "d3-array";
import type { EasingFunction } from "svelte/transition";

const LINEAR_SCALE_STORE_DEFAULTS = {
  duration: 0,
  easing: cubicOut,
  direction: "min",
  namespace: undefined,
};

interface extremumArgs {
  duration?: number;
  easing?: EasingFunction;
  direction?: string;
}

interface Extremum {
  value: (number | Date);
  override?: boolean;
}

interface ExtremaStoreValue {
  [key: string]: Extremum
}

const extremaFunctions = { min, max };

export function createExtremumResolutionStore(
  initialValue: (number | Date) = undefined,
  passedArgs: extremumArgs = {}
) {
  const args = { ...LINEAR_SCALE_STORE_DEFAULTS, ...passedArgs };
  const storedValues: Writable<ExtremaStoreValue> = writable({});
  const valueTween = tweened(initialValue || 0, {
    duration: args.duration,
    easing: args.easing,
  });

  /**
   *
   * @param key
   * @param value
   * @param override
   */
  function _update(key: string, value: number | Date, override = false) {
    storedValues.update((storeValue) => {
      if (!(key in storeValue))
        storeValue[key] = { value: undefined, override: false };
      storeValue[key].value = value;
      storeValue[key].override = override;
      return storeValue;
    });
  }

  function _remove(key) {
    storedValues.update((storeValue) => {
      delete storeValue[key];
      return storeValue;
    });
  }

  //
  const domainExtremum = derived(
    storedValues,
    ($storedValues) => {
      let extremum;
      const extrema: Extremum[] = [...Object.values($storedValues)]
      for (const entry of extrema) {
        if (entry.override) {
          extremum = entry.value;
          break;
        } else {
          extremum = extremaFunctions[args.direction]([entry.value, extremum]);
        }
      }
      return extremum;
    },
    undefined
  );

  // set the final tween with the value.
  domainExtremum.subscribe((value) => {
    if (value !== undefined) {
      valueTween.set(value);
    }
  });

  const returnedStore = {
    subscribe: valueTween.subscribe,
    setWithKey(key, value = undefined, override = undefined) {
      _update(key, value, override);
    },
    removeKey(key: string) {
      _remove(key);
    },
  };
  return returnedStore;
}
