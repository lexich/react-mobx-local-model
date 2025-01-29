import type {
  ForwardRefExoticComponent,
  ForwardRefRenderFunction,
  FunctionComponent,
  MemoExoticComponent,
  PropsWithoutRef,
  Ref,
  RefAttributes,
} from 'react';
import React, { forwardRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  comparer,
  computed,
  type IComputedValue,
  type IObservableValue,
  observable,
  runInAction,
} from 'mobx';
import type { ReactModel } from './ReactModel';

const hasSymbol = typeof Symbol === 'function' && Symbol.for;
const isFunctionNameConfigurable =
  Object.getOwnPropertyDescriptor(() => {}, 'name')?.configurable ?? false;

// Using react-is had some issues (and operates on elements, not on types), see #608 / #609
const ReactForwardRefSymbol = hasSymbol
  ? Symbol.for('react.forward_ref')
  : typeof React.forwardRef === 'function' &&
    React.forwardRef((props: any) => null)['$$typeof'];

const ReactMemoSymbol = hasSymbol
  ? Symbol.for('react.memo')
  : typeof React.memo === 'function' &&
    React.memo((props: any) => null)['$$typeof'];

type TParams<P extends object, TModel extends ReactModel<P>> = {
  [K in keyof (Omit<P, 'model'> & { model: TModel })]: (Omit<P, 'model'> & {
    model: TModel;
  })[K];
};

/**
 * A higher-order component (HOC) that wraps a given React component and a model class to create an observer component.
 * This observer component will automatically re-render when the model's observable properties change.
 *
 * @param Model - The model class to be instantiated and passed to the component.
 * @param baseComponent - The base React component to be wrapped.
 * @returns A memoized observer component that re-renders when the model's observable properties change.
 *
 * @remarks
 * - If static rendering is enabled, the observer component will not re-render on model changes.
 * - If the base component is wrapped with `forwardRef`, it will be unwrapped and re-wrapped after applying the observer logic.
 * - The observer component will inherit static properties, displayName, and contextTypes from the base component.
 *
 * @example
 *
 * ```tsx
 * class TestModel extends ReactModel<{ value: number; text: string }> {
 *   constructor() {
 *     super();
 *     makeObservable(this, {
 *       composition: computed
 *     })
 *   }
 *   get composition() {
 *      // we have access to all props from the Component
 *      return `${this.get('text')} - ${this.get('value')}`
 *   }
 * }
 *
 * const Component = observerWithModel(TestModel, ({ model, value, text }) => {
 *  // write component code
 * });
 * ```
 *
 * reimplemented https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts
 */
export function observerWithModel<
  TModel extends ReactModel<P>,
  P extends object = TModel['__type__'],
  TRef = {}
>(
  Model: {
    new (): TModel;
  },
  baseComponent: ForwardRefRenderFunction<TRef, TParams<P, TModel>>
): MemoExoticComponent<
  ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<TRef>>
>;
export function observerWithModel<
  TModel extends ReactModel<P>,
  P extends object = TModel['__type__'],
  TRef = {}
>(
  Model: {
    new (): TModel;
  },
  baseComponent: ForwardRefExoticComponent<
    PropsWithoutRef<TParams<P, TModel>> & RefAttributes<TRef>
  >
): MemoExoticComponent<
  ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<TRef>>
>;
export function observerWithModel<
  TModel extends ReactModel<P>,
  P extends object = TModel['__type__']
>(
  Model: {
    new (): TModel;
  },
  baseComponent: FunctionComponent<TParams<P, TModel>>
): FunctionComponent<P>;
// n.b. base case is not used for actual typings or exported in the typing files
export function observerWithModel<
  TModel extends ReactModel<P>,
  P extends object = TModel['__type__'],
  TRef = {}
>(
  Model: {
    new (): TModel;
  },
  baseComponent:
    | ForwardRefRenderFunction<TRef, TParams<P, TModel>>
    | FunctionComponent<TParams<P, TModel>>
    | ForwardRefExoticComponent<
        PropsWithoutRef<TParams<P, TModel>> & RefAttributes<TRef>
      >
) {
  if (
    ReactMemoSymbol &&
    (baseComponent as any)['$$typeof'] === ReactMemoSymbol
  ) {
    throw new Error(
      `[@writercolab/react-mobx] You are trying to use \`observer\` on a function component wrapped in either another \`observer\` or \`React.memo\`. The observer already applies 'React.memo' for you.`
    );
  }

  let useForwardRef = false;
  let render = baseComponent;

  // If already wrapped with forwardRef, unwrap,
  // so we can patch render and apply memo
  if (
    ReactForwardRefSymbol &&
    (baseComponent as any)['$$typeof'] === ReactForwardRefSymbol
  ) {
    render = (baseComponent as any)['render'];
    useForwardRef = true;

    if (typeof render !== 'function') {
      throw new Error(
        `[@writercolab/react-mobx] \`render\` property of ForwardRef was not a function`
      );
    }
  }

  const ObserverWrapper = observer<{
    model: TModel;
    $props: IObservableValue<any>;
    innerRef: TRef;
  }>(({ model, $props, innerRef }) =>
    render({ ...$props.get(), model }, innerRef as any)
  );

  ObserverWrapper.displayName = baseComponent.displayName
    ? `ObserverWrapper${baseComponent.displayName}`
    : baseComponent.displayName;

  if (isFunctionNameConfigurable) {
    Object.defineProperty(ObserverWrapper, 'name', {
      value: baseComponent.name
        ? `Wrap${baseComponent.name}`
        : baseComponent.name,
      writable: true,
      configurable: true,
    });
  }

  copyStaticProperties(baseComponent, ObserverWrapper);

  let observerComponent = (props: any, ref: Ref<TRef>): any => {
    const refProps = React.useRef<IObservableValue<any>>(null);

    if (!refProps.current) {
      refProps.current = observable.box(props, { deep: false });
    }

    const refModel = React.useRef<{
      model: TModel;
      dispose(): void;
    }>(null);

    if (!refModel.current) {
      refModel.current = createModel(Model, () => refProps.current?.get());
    }

    React.useEffect(() => () => refModel.current?.dispose(), []);

    React.useEffect(() => {
      const { current } = refProps;

      if (current) {
        runInAction(() => {
          if (!comparer.shallow(props, current.get())) {
            current.set(props);
          }
        });
      }
    }, [props]);

    return React.createElement(ObserverWrapper, {
      innerRef: ref as TRef,
      model: refModel.current.model,
      $props: refProps.current,
    });
  };

  // Inherit original name and displayName, see #3438
  (observerComponent as FunctionComponent).displayName =
    baseComponent.displayName;

  if (isFunctionNameConfigurable) {
    Object.defineProperty(observerComponent, 'name', {
      value: baseComponent.name,
      writable: true,
      configurable: true,
    });
  }

  if (useForwardRef) {
    // `forwardRef` must be applied prior `memo`
    // `forwardRef(observer(cmp))` throws:
    // "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))"
    observerComponent = forwardRef(observerComponent);
  }

  // memo; we are not interested in deep updates
  // in props; we assume that if deep objects are changed,
  // this is in observables, which would have been tracked anyway
  observerComponent = React.memo(observerComponent as any);

  copyStaticProperties(baseComponent, observerComponent);

  return observerComponent;
}

// based on https://github.com/mridgway/hoist-non-react-statics/blob/master/src/index.js
const hoistBlackList: any = {
  $$typeof: true,
  render: true,
  compare: true,
  type: true,
  // Don't redefine `displayName`,
  // it's defined as getter-setter pair on `memo` (see #3192).
  displayName: true,
};

/**
 * Copies static properties from the base component to the target component.
 *
 * @param base - The base component from which to copy properties.
 * @param target - The target component to which properties will be copied.
 */
function copyStaticProperties(base: any, target: any) {
  Object.keys(base).forEach((key) => {
    if (!hoistBlackList[key]) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      Object.defineProperty(
        target,
        key,
        Object.getOwnPropertyDescriptor(base, key)!
      );
    }
  });
}

/**
 * Creates a model instance and sets up computed properties for each key in the props.
 *
 * @param Model - The model class to instantiate.
 * @param getProps - A function that returns the current props.
 * @returns An object containing the model instance and a dispose function.
 */
function createModel<P extends object, TModel extends ReactModel<P>>(
  Model: {
    new (): TModel;
  },
  getProps: () => P
) {
  const model = new Model();
  const map = new Map<keyof P, IComputedValue<any>>();
  Object.assign(model, {
    get: <TKey extends keyof P>(key: TKey) => {
      let ref = map.get(key);

      if (!ref) {
        const equals = model.annotations?.[key] ?? comparer.identity;

        ref = computed(() => getProps()[key], { equals });
        map.set(key, ref);
      }

      return ref.get();
    },
  });

  function dispose() {
    Object.assign(model, { get: null });
    map.clear();
  }

  return {
    model,
    dispose,
  };
}
