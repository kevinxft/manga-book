import { useState } from 'react';

export function useOrganizerMutationErrors() {
  const [moveError, setMoveError] = useState<string | null>(null);

  return {
    moveError,
    setMoveError
  };
}
