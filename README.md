The `observerWithModel` higher-order component (HOC) function allows React components to create local MobX models that can utilize the components' props. This helps to avoid writing excessive boilerplate code and prevents unnecessary re-rendering of components during the synchronization of component props and `ReactModel` state. `observerWithModel` is a reimplementation of the official `observer` hook from the `mobx-react-lite` package.

## Usage

Here's an example of how to use `observerWithModel`:

```ts
import { ReactModel, observerWithModel } from 'react-mobx-local-model';
import { computed } from 'mobx';

// Each local model should extend the `ReactModel` class to create a local model for the component
// with the type arguments that will be used in the component later. The constructor of this kind
// of model shouldn't use any parameters because it will be created automatically like `new TestReactModel()`.
class TestReactModel extends ReactModel<{ name: string }> {
  constructor() {
    super({
      name: computed, // Use the computed decorator to optimize prop access if needed
    });
  }
  get text() {
    // Access the props using the `get` method
    return `Hello ${this.get('name')}`;
  }
}

// The component type will be inferred automatically, e.g., `FC<{ model: TestReactModel, name: string }>`
const Component = observerWithModel(TestReactModel, ({ model, name }) => {
  return (
    <div>
      {name} {model.text}
    </div>
  );
});
```

In the past, you would need to write a lot of boilerplate code, which could lead to extra re-renders of the `Component`. Here's how it used to be done:

```ts
import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { makeObservable, observable, runInAction } from 'mobx';

class TestReactModel {
  constructor() {
    makeObservable(this, {
      name: observable,
    });
  }
  name: string;

  get text() {
    return `Hello ${this.name}`;
  }
}

const Component = observer<{ name: string }>(({ name }) => {
  const model = useMemo(() => new TestReactModel());
  useEffect(() => {
    runInAction(() => {
      if (name !== model.name) {
        model.name = name;
      }
    });
  }, [name, model]);

  return (
    <div>
      {name} {model.text}
    </div>
  );
});
```
