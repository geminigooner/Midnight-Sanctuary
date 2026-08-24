export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (type === 'light') navigator.vibrate(10);
      if (type === 'medium') navigator.vibrate(20);
      if (type === 'heavy') navigator.vibrate([30, 50, 30]);
    } catch (e) {
      // Ignore
    }
  }
};
