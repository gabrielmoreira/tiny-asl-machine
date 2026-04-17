import type { Context } from '../../types';
import { describe, expect, it } from 'vite-plus/test';
import { replacePathTemplateFields } from './replacePathTemplateFields';

const awsJsonPathContext = {
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
    QueryLanguage: 'JSONPath',
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

const awsJsonataContext = {
  ...awsJsonPathContext,
  StateMachine: {
    ...awsJsonPathContext.StateMachine,
    QueryLanguage: 'JSONata',
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
      awsJsonPathContext
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
      awsJsonataContext
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
      awsJsonataContext
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
      awsJsonataContext,
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

  it('keeps JSONata wrapper strings literal in JSONPath contexts', async () => {
    const result = await replacePathTemplateFields(
      {
        literal: '{% $states.input.answer %}',
        plain: 'hello',
      },
      { answer: 42 },
      awsJsonPathContext
    );

    expect(result).toStrictEqual({
      literal: '{% $states.input.answer %}',
      plain: 'hello',
    });
  });

  it('returns non-template literals unchanged', async () => {
    await expect(
      replacePathTemplateFields('hello', { answer: 42 }, awsJsonPathContext)
    ).resolves.toBe('hello');
    await expect(replacePathTemplateFields(7, { answer: 42 }, awsJsonPathContext)).resolves.toBe(7);
    await expect(replacePathTemplateFields(null, { answer: 42 }, awsJsonPathContext)).resolves.toBe(
      null
    );
  });

  it('does not mutate the original template object', async () => {
    const template = {
      nested: {
        'value.$': '$.answer',
      },
    };

    const result = await replacePathTemplateFields(template, { answer: 99 }, awsJsonPathContext);

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
