/**
 * Frontend Component Tests - Basic
 */

import { render } from '@testing-library/react';
import App from '../App';

describe('App Component - Basic Tests', () => {
  
  test('App component is defined', () => {
    expect(App).toBeDefined();
  });

  test('App is a valid React component', () => {
    expect(typeof App).toBe('function');
  });

  test('renders without throwing error', () => {
    // Mock fetch to prevent API calls during test
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    );

    expect(() => {
      render(<App />);
    }).not.toThrow();

    // Cleanup
    global.fetch.mockRestore();
  });
});