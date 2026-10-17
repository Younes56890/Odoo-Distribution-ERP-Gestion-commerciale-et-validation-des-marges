import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useResource(method, params = {}, revision = 0, enabled = true) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  const serialized = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ data: null, loading: true, error: '' });
    api[method](JSON.parse(serialized)).then(
      data => active && setState({ data, loading: false, error: '' }),
      error => active && setState({ data: null, loading: false, error: error.message }),
    );
    return () => { active = false; };
  }, [method, serialized, revision, attempt, enabled]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}

export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
