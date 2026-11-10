import type { MatchCandidate } from './api';
import { fieldMatch } from './compare';

const features: MatchCandidate['features'] = {
  name: 0.94,
  dob: 1,
  father: 0.88,
  citizenship: 'unknown',
};

describe('how two values compare', () => {
  it('calls equal values the same', () => {
    expect(fieldMatch('name_ne', 'राम थापा', 'राम थापा', features)).toBe('same');
    expect(fieldMatch('ward_no', '4', '4', features)).toBe('same');
  });

  it('calls a name close when the matcher scored the names alike', () => {
    expect(fieldMatch('name_en', 'Raam Thapa', 'Ram Thapa', features)).toBe('close');
    expect(fieldMatch('father_name_ne', 'हरि बहादुर थापा', 'हरिबहादुर थापा', features)).toBe(
      'close',
    );
    expect(fieldMatch('name_en', 'Sita Rai', 'Ram Thapa', { ...features, name: 0.4 })).toBe(
      'different',
    );
  });

  it('calls any other unequal value different', () => {
    expect(fieldMatch('ward_no', '4', '9', features)).toBe('different');
    expect(fieldMatch('gender', 'male', 'female', features)).toBe('different');
  });

  it('does not guess when one side is missing', () => {
    expect(fieldMatch('dob_ad', null, '1988-06-26', features)).toBe('unknown');
    expect(fieldMatch('tole', '', 'Bazaar', features)).toBe('unknown');
  });
});
