import { act, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { RootApp } from '../app';

type RootAppTestProps = ComponentProps<typeof RootApp>;

export async function renderRootApp(props: RootAppTestProps = {}) {
  let rendered: ReturnType<typeof render> | undefined;
  await act(async () => {
    rendered = render(<RootApp devEnvironmentEnabled={false} {...props} />);
  });

  if (!rendered) {
    throw new Error('Expected RootApp to render in test.');
  }

  return rendered;
}
