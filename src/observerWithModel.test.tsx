import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import React, { useState } from 'react';
import { renderToString } from 'react-dom/server';
import {
  comparer,
  computed,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import { enableStaticRendering } from 'mobx-react-lite';
import { render, screen, act } from '@testing-library/react';
import { ReactModel } from './ReactModel';
import { observerWithModel } from './observerWithModel';

class TestModel extends ReactModel<{ value: number; text: string }> {
  constructor() {
    super({ value: comparer.identity });
    makeObservable(this, {
      value: computed,
      multiplier: observable,
    });
  }

  multiplier = 10;

  get value() {
    const val = this.get('value');

    return val * this.multiplier;
  }
}

describe('observerWithModel', () => {
  const Component = observerWithModel(TestModel, ({ model, value }) => {
    const refCounter = React.useRef(0);
    refCounter.current += 1;

    return (
      <div>
        <p role="original">{value}</p>
        <p role="value">Value: {model.value}</p>
        <p role="counter">Counter: {refCounter.current}</p>
        <button
          type="button"
          role="multiplier"
          onClick={() => {
            runInAction(() => {
              model.multiplier *= 10;
            });
          }}
        />
      </div>
    );
  });

  const Container = () => {
    const [value, setValue] = useState(10);

    return (
      <div>
        <Component value={value} text="test" />
        <button
          type="button"
          role="button"
          onClick={() => setValue((v) => v + 1)}
        >
          Increment
        </button>
      </div>
    );
  };

  it('should render the model and update the value and counter on button click', () => {
    render(<Container />);
    const $btn = screen.getByRole('button');
    expect($btn).not.toBeNull();

    const $value = screen.getByRole('value');
    expect($value).not.toBeNull();
    expect($value.innerHTML).toBe('Value: 100');

    const $counter = screen.getByRole('counter');
    expect($counter).not.toBeNull();
    expect($counter.innerHTML).toBe('Counter: 1');

    const $original = screen.getByRole('original');
    expect($original).not.toBeNull();
    expect($original.innerHTML).toBe('10');

    act(() => $btn.click());

    expect($value.innerHTML).toBe('Value: 110'); // Updated value (11 * 10)
    expect($counter.innerHTML).toBe('Counter: 2');
    expect($original.innerHTML).toBe('11');

    const $multiplier = screen.getByRole('multiplier');
    act(() => $multiplier.click());
    expect($value.innerHTML).toBe('Value: 1100'); // Updated value (11 * 10)
    expect($counter.innerHTML).toBe('Counter: 3');
  });

  describe('server side rendering', () => {
    beforeAll(() => enableStaticRendering(true));
    afterAll(() => enableStaticRendering(false));

    it('should render correctly on the server', () => {
      const data = renderToString(<Container />);

      expect(data).toMatchInlineSnapshot(
        `"<div><div><p role="original">10</p><p role="value">Value: <!-- -->100</p><p role="counter">Counter: <!-- -->1</p><button type="button" role="multiplier"></button></div><button type="button" role="button">Increment</button></div>"`
      );
    });
  });

  it('should correctly handle forward ref case', async () => {
    const TestComponent = React.forwardRef<
      HTMLDivElement,
      { model: TestModel } & TestModel['__type__']
    >(({ model }, ref) => {
      const { value } = model;

      return <div ref={ref}>{value}</div>;
    });

    TestComponent.displayName = 'TestComponent';

    const ComponentRef = observerWithModel(TestModel, TestComponent);

    const TestContainer: React.FC<{
      setRef: (value: HTMLDivElement) => void;
    }> = ({ setRef }) => (
      <div>
        <ComponentRef ref={setRef} value={10} text="test" />
      </div>
    );

    const el = await new Promise<HTMLDivElement | null>((resolve, reject) => {
      render(<TestContainer setRef={resolve} />);

      setTimeout(() => reject(new Error('timeout')), 100);
    });

    expect(el?.innerHTML).toBe('100');
  });
});
