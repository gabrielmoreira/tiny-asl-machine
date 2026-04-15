import type { Context } from '../../types';
import { describe, expect, it } from 'vitest';
import { replacePathTemplateFields } from './replacePathTemplateFields';

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
    RetryCount: 0,
  },
  Task: {
    Token: 'TaskToken-abc',
  },
} as unknown as Context;

describe('replacePathTemplateFields', () => {
  it('replaces JSONPath .$ fields and renames the key', async () => {
    const result = await replacePathTemplateFields(
      {
        'name.$': '$.user.name',
      },
      {
        user: { name: 'Alice' },
      },
      awsContext
    );

    expect(result).toStrictEqual({
      name: 'Alice',
    });
  });

  it('evaluates a top-level JSONata string template', async () => {
    const result = await replacePathTemplateFields(
      '{% {"hello": $states.input.user.name, "retry": $states.context.State.RetryCount} %}',
      {
        user: { name: 'Alice' },
      },
      awsContext
    );

    expect(result).toStrictEqual({
      hello: 'Alice',
      retry: 0,
    });
  });

  it('supports JSONPath .$ keys and nested JSONata strings in the same object', async () => {
    const result = await replacePathTemplateFields(
      {
        'name.$': '$.user.name',
        meta: {
          executionId: '{% $states.context.Execution.Id %}',
          retryCount: '{% $states.context.State.RetryCount %}',
        },
      },
      {
        user: { name: 'Alice' },
      },
      awsContext
    );

    expect(result).toStrictEqual({
      name: 'Alice',
      meta: {
        executionId: 'arn:aws:states:us-east-1:123456789012:execution:MyStateMachine:exec-abc-123',
        retryCount: 0,
      },
    });
  });

  it('passes result and errorOutput bindings into nested JSONata values', async () => {
    const result = await replacePathTemplateFields(
      {
        payload: '{% $states.result.Payload %}',
        payloadString: '{% $string($states.result.Payload) %}',
        error: '{% $states.errorOutput %}',
      },
      {},
      awsContext,
      {
        Payload: { ok: true },
      },
      {
        Error: 'Boom',
        Cause: 'Failure',
      }
    );

    expect(result).toStrictEqual({
      payload: { ok: true },
      payloadString: '{"ok":true}',
      error: {
        Error: 'Boom',
        Cause: 'Failure',
      },
    });
  });

  it('does not mutate the original template object', async () => {
    const template = {
      nested: {
        'value.$': '$.answer',
      },
    };

    const result = await replacePathTemplateFields(template, { answer: 99 }, awsContext);

    expect(result).toStrictEqual({
      nested: {
        value: 99,
      },
    });
    expect(template).toStrictEqual({
      nested: {
        'value.$': '$.answer',
      },
    });
  });
});
