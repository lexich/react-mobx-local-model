import { type IEqualsComparer } from 'mobx';

/**
 * Abstract class representing a React model with typed parameters.
 *
 * @example
 *
 * ```ts
 * class TestReactModel extends ReactModel<{ name: string }> {
 *   get text() {
 *     return `Hello ${this.get('name')}`;
 *   }
 * }
 * ```
 */
/**
 * An abstract class representing a React model with generic properties.
 *
 * @template TProps - The type of the properties that this model will handle.
 */
export abstract class ReactModel<TProps extends object> {
  /**
   * A placeholder property used to extract TProps type for extending classes.
   *
   * @type {TProps} The type parameter that this property enforces.
   */
  readonly __type__!: TProps;

  /**
   * A method to get the value of a property by its key.
   *
   * @template TKey - The key of the property to get.
   * @param {TKey} key - The key of the property.
   * @returns {TProps[TKey]} The value of the property.
   */
  protected get: <TKey extends keyof TProps>(key: TKey) => TProps[TKey];

  constructor(
    /**
     * define annotations for props comparator during access to this property using `get` method
     */
    readonly annotations?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [K in keyof TProps]?: IEqualsComparer<any>;
    },
  ) {
    this.get = die as unknown as typeof this.get;
  }
}

function die(): unknown {
  throw new Error('need to be reimplemented with useModel');
}
