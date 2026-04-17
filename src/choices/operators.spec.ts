import type { Context, State, TopLevelChoiceRule } from '../../types';
import { describe, it, expect } from 'vite-plus/test';
import { processChoices } from './operators';
import { runState } from '../states/index';

const createAwsContext = (): Context =>
  (<Context>{
    Execution: {
      Id: 'arn:aws:states:us-east-1:123456789012:execution:MyStateMachine:exec-abc-123',
      Name: 'exec-abc-123',
      Input: { source: 'operators.spec.ts' },
      RoleArn: 'arn:aws:iam::123456789012:role/StepFunctionsRole',
      StartTime: '2025-01-01T00:00:00.000Z',
    },
    StateMachine: {
      Id: 'arn:aws:states:us-east-1:123456789012:stateMachine:MyStateMachine',
      Name: 'MyStateMachine',
    },
    State: {
      Name: 'TestState',
      EnteredTime: '2025-01-01T00:00:01.000Z',
      RetryCount: 0,
    },
  }) as unknown as Context;

const evaluateChoices = (
  choices: TopLevelChoiceRule[],
  input: unknown,
  context = createAwsContext()
) => processChoices(context, choices, input);

const evaluateChoice = (choice: TopLevelChoiceRule, input: unknown, context = createAwsContext()) =>
  evaluateChoices([choice], input, context);

describe('processChoices', () => {
  describe('Logical operators', () => {
    describe('And', () => {
      it('matches when all nested rules evaluate to true', () => {
        expect(
          evaluateChoice(
            {
              And: [
                { Variable: '$.status', StringEquals: 'READY' },
                { Variable: '$.attempt', NumericGreaterThanEquals: 2 },
              ],
              Next: 'Approved',
            },
            { status: 'READY', attempt: 2 }
          )
        ).toBe('Approved');
      });

      it('returns undefined when any nested rule evaluates to false', () => {
        expect(
          evaluateChoice(
            {
              And: [
                { Variable: '$.status', StringEquals: 'READY' },
                { Variable: '$.attempt', NumericGreaterThanEquals: 2 },
              ],
              Next: 'Approved',
            },
            { status: 'READY', attempt: 1 }
          )
        ).toBeUndefined();
      });

      it('supports nested logical rules', () => {
        expect(
          evaluateChoice(
            {
              And: [
                {
                  And: [
                    { Variable: '$.kind', StringEquals: 'order' },
                    { Variable: '$.confirmed', BooleanEquals: true },
                  ],
                },
                { Variable: '$.total', NumericGreaterThan: 100 },
              ],
              Next: 'HighValueOrder',
            },
            { kind: 'order', confirmed: true, total: 150 }
          )
        ).toBe('HighValueOrder');
      });
    });

    describe('Or', () => {
      it('matches when at least one nested rule evaluates to true', () => {
        expect(
          evaluateChoice(
            {
              Or: [
                { Variable: '$.category', StringEquals: 'gold' },
                { Variable: '$.points', NumericGreaterThanEquals: 1000 },
              ],
              Next: 'Priority',
            },
            { category: 'silver', points: 1000 }
          )
        ).toBe('Priority');
      });

      it('returns undefined when all nested rules evaluate to false', () => {
        expect(
          evaluateChoice(
            {
              Or: [
                { Variable: '$.category', StringEquals: 'gold' },
                { Variable: '$.points', NumericGreaterThanEquals: 1000 },
              ],
              Next: 'Priority',
            },
            { category: 'silver', points: 999 }
          )
        ).toBeUndefined();
      });
    });

    describe('Not', () => {
      it('inverts the nested rule result', () => {
        expect(
          evaluateChoice(
            {
              Not: { Variable: '$.visibility', StringEquals: 'Private' },
              Next: 'PublicFlow',
            },
            { visibility: 'Public' }
          )
        ).toBe('PublicFlow');
      });
    });
  });

  describe('String operators', () => {
    describe('StringEquals', () => {
      it('matches identical strings', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringEquals: 'hello', Next: 'Matched' },
            { value: 'hello' }
          )
        ).toBe('Matched');
      });

      it('returns undefined for a different string', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringEquals: 'hello', Next: 'Matched' },
            { value: 'world' }
          )
        ).toBeUndefined();
      });
    });

    describe('StringLessThan', () => {
      it('matches when the input string sorts before the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringLessThan: 'bravo', Next: 'BeforeBravo' },
            { value: 'alpha' }
          )
        ).toBe('BeforeBravo');
      });

      it('returns undefined when the input string does not sort before the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringLessThan: 'bravo', Next: 'BeforeBravo' },
            { value: 'bravo' }
          )
        ).toBeUndefined();
      });
    });

    describe('StringGreaterThan', () => {
      it('matches when the input string sorts after the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringGreaterThan: 'bravo', Next: 'AfterBravo' },
            { value: 'charlie' }
          )
        ).toBe('AfterBravo');
      });

      it('returns undefined when the input string does not sort after the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringGreaterThan: 'bravo', Next: 'AfterBravo' },
            { value: 'bravo' }
          )
        ).toBeUndefined();
      });
    });

    describe('StringLessThanEquals', () => {
      it('matches when the input string equals the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringLessThanEquals: 'bravo', Next: 'BeforeOrEqual' },
            { value: 'bravo' }
          )
        ).toBe('BeforeOrEqual');
      });

      it('returns undefined when the input string sorts after the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringLessThanEquals: 'bravo', Next: 'BeforeOrEqual' },
            { value: 'charlie' }
          )
        ).toBeUndefined();
      });
    });

    describe('StringGreaterThanEquals', () => {
      it('matches when the input string equals the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringGreaterThanEquals: 'bravo', Next: 'AfterOrEqual' },
            { value: 'bravo' }
          )
        ).toBe('AfterOrEqual');
      });

      it('returns undefined when the input string sorts before the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', StringGreaterThanEquals: 'bravo', Next: 'AfterOrEqual' },
            { value: 'alpha' }
          )
        ).toBeUndefined();
      });
    });
  });

  describe('StringMatches', () => {
    it('matches an exact string', () => {
      expect(
        evaluateChoice(
          { Variable: '$.value', StringMatches: 'invoice-2025.json', Next: 'Matched' },
          { value: 'invoice-2025.json' }
        )
      ).toBe('Matched');
    });

    it('matches a wildcard pattern with a single asterisk', () => {
      expect(
        evaluateChoice(
          { Variable: '$.value', StringMatches: 'invoice-*.json', Next: 'Matched' },
          { value: 'invoice-2025.json' }
        )
      ).toBe('Matched');
    });

    it('matches a pattern with multiple wildcards', () => {
      expect(
        evaluateChoice(
          { Variable: '$.value', StringMatches: 'logs-*-*-done', Next: 'Matched' },
          { value: 'logs-2025-04-done' }
        )
      ).toBe('Matched');
    });

    it('treats an escaped asterisk as a literal character', () => {
      expect(
        evaluateChoice(
          { Variable: '$.value', StringMatches: 'file\\*name.txt', Next: 'Matched' },
          { value: 'file*name.txt' }
        )
      ).toBe('Matched');
    });

    it('returns undefined when the pattern does not match', () => {
      expect(
        evaluateChoice(
          { Variable: '$.value', StringMatches: 'invoice-*.json', Next: 'Matched' },
          { value: 'report-2025.json' }
        )
      ).toBeUndefined();
    });
  });

  describe('Numeric operators', () => {
    describe('NumericEquals', () => {
      it('matches identical numbers', () => {
        expect(
          evaluateChoice({ Variable: '$.value', NumericEquals: 42, Next: 'Matched' }, { value: 42 })
        ).toBe('Matched');
      });

      it('returns undefined for a different number', () => {
        expect(
          evaluateChoice({ Variable: '$.value', NumericEquals: 42, Next: 'Matched' }, { value: 41 })
        ).toBeUndefined();
      });
    });

    describe('NumericLessThan', () => {
      it('matches when the input number is smaller than the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericLessThan: 10, Next: 'Matched' },
            { value: 9 }
          )
        ).toBe('Matched');
      });

      it('returns undefined when the input number is not smaller than the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericLessThan: 10, Next: 'Matched' },
            { value: 10 }
          )
        ).toBeUndefined();
      });
    });

    describe('NumericGreaterThan', () => {
      it('matches when the input number is larger than the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericGreaterThan: 10, Next: 'Matched' },
            { value: 11 }
          )
        ).toBe('Matched');
      });

      it('returns undefined when the input number is not larger than the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericGreaterThan: 10, Next: 'Matched' },
            { value: 10 }
          )
        ).toBeUndefined();
      });
    });

    describe('NumericLessThanEquals', () => {
      it('matches when the input number equals the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericLessThanEquals: 10, Next: 'Matched' },
            { value: 10 }
          )
        ).toBe('Matched');
      });

      it('returns undefined when the input number is larger than the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericLessThanEquals: 10, Next: 'Matched' },
            { value: 11 }
          )
        ).toBeUndefined();
      });
    });

    describe('NumericGreaterThanEquals', () => {
      it('matches when the input number equals the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericGreaterThanEquals: 10, Next: 'Matched' },
            { value: 10 }
          )
        ).toBe('Matched');
      });

      it('returns undefined when the input number is smaller than the rule value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', NumericGreaterThanEquals: 10, Next: 'Matched' },
            { value: 9 }
          )
        ).toBeUndefined();
      });
    });
  });

  describe('Numeric Path operators', () => {
    describe('NumericEqualsPath', () => {
      it('matches when both numeric paths resolve to the same value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', NumericEqualsPath: '$.right', Next: 'Matched' },
            { left: 7, right: 7 }
          )
        ).toBe('Matched');
      });
    });

    describe('NumericLessThanPath', () => {
      it('matches when the variable path resolves to a smaller value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', NumericLessThanPath: '$.right', Next: 'Matched' },
            { left: 7, right: 8 }
          )
        ).toBe('Matched');
      });
    });

    describe('NumericGreaterThanPath', () => {
      it('matches when the variable path resolves to a larger value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', NumericGreaterThanPath: '$.right', Next: 'Matched' },
            { left: 9, right: 8 }
          )
        ).toBe('Matched');
      });
    });

    describe('NumericLessThanEqualsPath', () => {
      it('matches when both numeric paths resolve to equal values', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', NumericLessThanEqualsPath: '$.right', Next: 'Matched' },
            { left: 8, right: 8 }
          )
        ).toBe('Matched');
      });
    });

    describe('NumericGreaterThanEqualsPath', () => {
      it('matches when both numeric paths resolve to equal values', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', NumericGreaterThanEqualsPath: '$.right', Next: 'Matched' },
            { left: 8, right: 8 }
          )
        ).toBe('Matched');
      });
    });
  });

  describe('Boolean operators', () => {
    describe('BooleanEquals', () => {
      it('matches true values', () => {
        expect(
          evaluateChoice(
            { Variable: '$.approved', BooleanEquals: true, Next: 'Approved' },
            { approved: true }
          )
        ).toBe('Approved');
      });

      it('matches false values', () => {
        expect(
          evaluateChoice(
            { Variable: '$.approved', BooleanEquals: false, Next: 'Rejected' },
            { approved: false }
          )
        ).toBe('Rejected');
      });
    });

    describe('BooleanEqualsPath', () => {
      it('matches when both boolean paths resolve to the same value', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', BooleanEqualsPath: '$.right', Next: 'Matched' },
            { left: true, right: true }
          )
        ).toBe('Matched');
      });
    });
  });

  describe('Timestamp operators', () => {
    const timestamps = {
      earlier: '2025-01-01T00:00:00.000Z',
      middle: '2025-01-01T12:00:00.000Z',
      later: '2025-01-02T00:00:00.000Z',
    };

    describe('TimestampEquals', () => {
      it('matches identical timestamps', () => {
        expect(
          evaluateChoice(
            { Variable: '$.timestamp', TimestampEquals: timestamps.middle, Next: 'Matched' },
            { timestamp: timestamps.middle }
          )
        ).toBe('Matched');
      });
    });

    describe('TimestampLessThan', () => {
      it('matches when the variable timestamp is earlier than the rule timestamp', () => {
        expect(
          evaluateChoice(
            { Variable: '$.timestamp', TimestampLessThan: timestamps.later, Next: 'Matched' },
            { timestamp: timestamps.middle }
          )
        ).toBe('Matched');
      });
    });

    describe('TimestampGreaterThan', () => {
      it('matches when the variable timestamp is later than the rule timestamp', () => {
        expect(
          evaluateChoice(
            { Variable: '$.timestamp', TimestampGreaterThan: timestamps.earlier, Next: 'Matched' },
            { timestamp: timestamps.middle }
          )
        ).toBe('Matched');
      });
    });

    describe('TimestampLessThanEquals', () => {
      it('matches when the variable timestamp equals the rule timestamp', () => {
        expect(
          evaluateChoice(
            {
              Variable: '$.timestamp',
              TimestampLessThanEquals: timestamps.middle,
              Next: 'Matched',
            },
            { timestamp: timestamps.middle }
          )
        ).toBe('Matched');
      });
    });

    describe('TimestampGreaterThanEquals', () => {
      it('matches when the variable timestamp equals the rule timestamp', () => {
        expect(
          evaluateChoice(
            {
              Variable: '$.timestamp',
              TimestampGreaterThanEquals: timestamps.middle,
              Next: 'Matched',
            },
            { timestamp: timestamps.middle }
          )
        ).toBe('Matched');
      });
    });

    describe('Path variants', () => {
      it('matches TimestampEqualsPath', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', TimestampEqualsPath: '$.right', Next: 'Matched' },
            { left: timestamps.middle, right: timestamps.middle }
          )
        ).toBe('Matched');
      });

      it('matches TimestampLessThanPath', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', TimestampLessThanPath: '$.right', Next: 'Matched' },
            { left: timestamps.earlier, right: timestamps.middle }
          )
        ).toBe('Matched');
      });

      it('matches TimestampGreaterThanPath', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', TimestampGreaterThanPath: '$.right', Next: 'Matched' },
            { left: timestamps.later, right: timestamps.middle }
          )
        ).toBe('Matched');
      });

      it('matches TimestampLessThanEqualsPath', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', TimestampLessThanEqualsPath: '$.right', Next: 'Matched' },
            { left: timestamps.middle, right: timestamps.middle }
          )
        ).toBe('Matched');
      });

      it('matches TimestampGreaterThanEqualsPath', () => {
        expect(
          evaluateChoice(
            { Variable: '$.left', TimestampGreaterThanEqualsPath: '$.right', Next: 'Matched' },
            { left: timestamps.middle, right: timestamps.middle }
          )
        ).toBe('Matched');
      });
    });
  });

  describe('Type test operators', () => {
    describe('IsNull', () => {
      it('matches when the variable is null and IsNull is true', () => {
        expect(
          evaluateChoice({ Variable: '$.value', IsNull: true, Next: 'Matched' }, { value: null })
        ).toBe('Matched');
      });

      it('matches when the variable is not null and IsNull is false', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', IsNull: false, Next: 'Matched' },
            { value: 'not-null' }
          )
        ).toBe('Matched');
      });
    });

    describe('IsPresent', () => {
      it('returns undefined for a missing path when IsPresent is true', () => {
        expect(
          evaluateChoice({ Variable: '$.missing', IsPresent: true, Next: 'Matched' }, { value: 1 })
        ).toBeUndefined();
      });

      it('matches for a missing path when IsPresent is false', () => {
        expect(
          evaluateChoice({ Variable: '$.missing', IsPresent: false, Next: 'Matched' }, { value: 1 })
        ).toBe('Matched');
      });
    });

    describe('IsNumeric', () => {
      it('matches numeric values', () => {
        expect(
          evaluateChoice({ Variable: '$.value', IsNumeric: true, Next: 'Matched' }, { value: 3.14 })
        ).toBe('Matched');
      });
    });

    describe('IsString', () => {
      it('matches string values', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', IsString: true, Next: 'Matched' },
            { value: 'hello' }
          )
        ).toBe('Matched');
      });
    });

    describe('IsBoolean', () => {
      it('matches boolean values', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', IsBoolean: true, Next: 'Matched' },
            { value: false }
          )
        ).toBe('Matched');
      });
    });

    describe('IsTimestamp', () => {
      it('matches a supported RFC3339-style timestamp string', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', IsTimestamp: true, Next: 'Matched' },
            { value: '2025-01-01T00:00:00Z' }
          )
        ).toBe('Matched');
      });

      it('returns undefined for an invalid timestamp string', () => {
        expect(
          evaluateChoice(
            { Variable: '$.value', IsTimestamp: true, Next: 'Matched' },
            { value: 'not-a-timestamp' }
          )
        ).toBeUndefined();
      });
    });
  });

  describe('Edge cases', () => {
    it('returns undefined for type mismatches that do not satisfy a choice rule', () => {
      expect(
        evaluateChoices(
          [
            { Variable: '$.value', StringEquals: '1', Next: 'StringMatch' },
            { Variable: '$.value', NumericEquals: 1, Next: 'NumericMatch' },
            { Variable: '$.value', BooleanEquals: true, Next: 'BooleanMatch' },
          ],
          { value: 'true' }
        )
      ).toBeUndefined();
    });

    it('supports an And rule containing an Or rule', () => {
      expect(
        evaluateChoice(
          {
            And: [
              {
                Or: [
                  { Variable: '$.tier', StringEquals: 'gold' },
                  { Variable: '$.expedited', BooleanEquals: true },
                ],
              },
              { Variable: '$.amount', NumericGreaterThan: 50 },
            ],
            Next: 'FastTrack',
          },
          { tier: 'silver', expedited: true, amount: 75 }
        )
      ).toBe('FastTrack');
    });

    it('uses the Choice state Default transition when no rule matches', async () => {
      const state: State = {
        Type: 'Choice',
        Choices: [{ Variable: '$.status', StringEquals: 'READY', Next: 'ReadyState' }],
        Default: 'DefaultState',
      };
      const context = createAwsContext();
      const input = { status: 'PENDING' };
      await expect(runState(context, state, input)).resolves.toStrictEqual(input);
      expect(context.Transition).toStrictEqual({ Next: 'DefaultState' });
    });

    it('throws States.Runtime when no rule matches and there is no Default', async () => {
      const state: State = {
        Type: 'Choice',
        Choices: [{ Variable: '$.status', StringEquals: 'READY', Next: 'ReadyState' }],
      };
      await expect(
        runState(createAwsContext(), state, { status: 'PENDING' })
      ).rejects.toMatchObject({
        name: 'States.Runtime',
        message: expect.stringContaining(
          'Failed to transition out of the state. The state does not point to a next state.'
        ),
      });
    });
  });
});
