import { describe, it, expect } from 'vitest';
import { getMotion, obsidianMotion, resolveSharedLayoutId } from './motion';

describe('shared element motion system', () => {
  it('returns critically damped sharedSpring when reducedMotion is false', () => {
    expect(getMotion('shared', false)).toEqual(obsidianMotion.sharedSpring);
    expect(getMotion('backdrop', false)).toEqual(obsidianMotion.backdrop);
  });

  it('falls back to reduced tween preset when reducedMotion is true', () => {
    expect(getMotion('shared', true)).toEqual(obsidianMotion.reduced);
    expect(getMotion('backdrop', true)).toEqual(obsidianMotion.reduced);
  });

  it('scopes shared layoutIds cleanly and disables them under reduced motion', () => {
    expect(resolveSharedLayoutId('chat-header-gifts', false)).toBe('chat-header-gifts');
    expect(resolveSharedLayoutId('chat-header-gifts', false, 'icon')).toBe('chat-header-gifts-icon');
    expect(resolveSharedLayoutId('chat-header-gifts', true)).toBeUndefined();
    expect(resolveSharedLayoutId(undefined, false)).toBeUndefined();
  });
});
