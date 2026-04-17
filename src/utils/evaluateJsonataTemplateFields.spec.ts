import type { Context } from '../../types';
import { describe, expect, it } from 'vite-plus/test';
import { evaluateJsonataTemplateFields } from './evaluateJsonataTemplateFields';
import { isJsonataString, extractJsonataExpression } from './jsonataTemplate';

const awsContext = {
  Execution: {
    Id: 'arn:aws:states:us-east-1:123456789012:execution:MyStateMachine:exec-abc-123',
    Name: 'exec-abc-123',
    Input: {},
    RoleArn: 'arn:aws:iam::123456789012:role/StepFunctionsRole',
    StartTime: '2025-01-01T00:00:00.000Z',
    RedriveCount: 0,
  },
  StateMachine: {
    Id: 'arn:aws:states:us-east-1:123456789012:stateMachine:MyStateMachine',
    Name: 'MyStateMachine',
  },
  State: {
    Name: 'TestState',
    EnteredTime: '2025-01-01T00:00:01.000Z',
    RetryCount: 2,
  },
  Task: {
    Token: 'TaskToken-abc',
  },
} as unknown as Context;

describe('evaluateJsonataTemplateFields', () => {
  it('evaluates top-level JSONata strings with states bindings', async () => {
    const result = await evaluateJsonataTemplateFields('{% $states.input.user.name %}', {
      input: { user: { name: 'Alice' } },
      context: awsContext,
    });

    expect(result).toBe('Alice');
  });

  it('makes custom bindings available to the JSONata scope', async () => {
    const result = await evaluateJsonataTemplateFields(
      '{% $prefix & ":" & $states.input.user.name %}',
      {
        input: { user: { name: 'Alice' } },
        context: awsContext,
      },
      {
        prefix: 'user',
      }
    );

    expect(result).toBe('user:Alice');
  });

  it('evaluates nested objects and arrays with result and errorOutput bindings', async () => {
    const result = await evaluateJsonataTemplateFields(
      {
        payload: '{% $states.result.Payload %}',
        payloadString: '{% $string($states.result.Payload) %}',
        error: '{% $states.errorOutput.Error %}',
        values: ['static', '{% $states.context.Task.Token %}'],
      },
      {
        input: {},
        context: awsContext,
        result: { Payload: { ok: true } },
        errorOutput: { Error: 'Boom', Cause: 'Failure' },
      }
    );

    expect(result).toStrictEqual({
      payload: { ok: true },
      payloadString: '{"ok":true}',
      error: 'Boom',
      values: ['static', 'TaskToken-abc'],
    });
  });

  it('supports multiline JSONata expressions that build objects', async () => {
    const result = await evaluateJsonataTemplateFields(
      `
      {%
        {
          "sum": $sum($states.input.values),
          "count": $count($states.input.values)
        }
      %}
      `,
      {
        input: { values: [1, 2, 3] },
        context: awsContext,
      }
    );

    expect(result).toStrictEqual({
      sum: 6,
      count: 3,
    });
  });

  it('throws States.QueryEvaluationError when the expression evaluates to undefined', async () => {
    await expect(
      evaluateJsonataTemplateFields('{% $states.input.missing %}', {
        input: {},
        context: awsContext,
      })
    ).rejects.toMatchObject({
      name: 'States.QueryEvaluationError',
      message: expect.stringContaining('evaluated to undefined'),
    });
  });

  it('wraps non-ExecutionError failures as States.QueryEvaluationError', async () => {
    await expect(
      evaluateJsonataTemplateFields('{% $sum($states.input.value) %}', {
        input: { value: 'not-an-array' },
        context: awsContext,
      })
    ).rejects.toMatchObject({
      name: 'States.QueryEvaluationError',
      message: expect.stringContaining('Failed to evaluate JSONata expression'),
    });
  });

  it('preserves null results and distinguishes them from undefined', async () => {
    const result = await evaluateJsonataTemplateFields('{% $states.result.optional %}', {
      input: {},
      context: awsContext,
      result: { optional: null },
    });

    expect(result).toBeNull();
  });

  it('treats whitespace-only expressions as query evaluation errors', async () => {
    await expect(
      evaluateJsonataTemplateFields('{%   %}', {
        input: {},
        context: awsContext,
      })
    ).rejects.toMatchObject({
      name: 'States.QueryEvaluationError',
    });
  });
});

describe('jsonataTemplate helpers', () => {
  it('detects JSONata template strings and extracts inner expressions', () => {
    expect(isJsonataString('{% $states.input %}')).toBe(true);
    expect(isJsonataString('plain text')).toBe(false);
    expect(extractJsonataExpression('{% $states.input.value %}')).toBe('$states.input.value');
  });
});
