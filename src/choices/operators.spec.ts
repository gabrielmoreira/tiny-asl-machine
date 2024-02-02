import { TopLevelChoiceRule } from '../../types/asl';
import { Context } from '../../types/runtime';
import { Operators } from './operators';

const context = {} as unknown as Context;

describe('Logical operators', () => {
  describe('And', () => {
    // Given
    const choice: TopLevelChoiceRule = {
      And: [
        { StringEquals: 'yes', Variable: '$.value' },
        { IsPresent: true, Variable: '$.value' },
      ],
      Next: 'Success',
    };
    const operator = Operators['And'];
    it('should return next state if it evaluates to true', () => {
      // When
      const result = operator(context, { value: 'yes' }, choice);
      // Then
      expect(result).toBe('Success');
    });
    it('should return undefined if it evaluates to false', () => {
      // When
      const result = operator(context, { value: 'no' }, choice);
      // Then
      expect(result).toBeUndefined();
    });
  });
});

describe('String comparison operators', () => {
  describe('StringLessThan', () => {
    // Given
    const choice: TopLevelChoiceRule = {
      StringLessThan: 'B',
      Variable: '$.value',
      Next: 'Success',
    };
    const operator = Operators['StringLessThan'];
    it('should evaluates to true', () => {
      // When
      const result = operator(context, { value: 'A' }, choice);
      // Then
      expect(result).toBe(true);
    });
    it('should evaluates to false', () => {
      // When
      const result = operator(context, { value: 'B' }, choice);
      // Then
      expect(result).toBe(false);
    });
    it('should evaluates to false (alternative)', () => {
      // When
      const result = operator(context, { value: 'C' }, choice);
      // Then
      expect(result).toBe(false);
    });
  });
});
