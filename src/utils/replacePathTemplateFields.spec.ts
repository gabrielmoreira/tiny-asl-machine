import type { Context } from '../../types';
import { describe, it, expect } from 'vitest';
import { replacePathTemplateFields } from './replacePathTemplateFields';

describe('replacePathTemplateFields', () => {
  const awsContext = (<Context>{
    Execution: {
      Id: 'arn:aws:states:us-east-1:123456789012:execution:MyStateMachine:exec-abc-123',
      Name: 'exec-abc-123',
      Input: {},
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

  describe('basic path resolution', () => {
    it('replaces a single template field from input and renames the key', () => {
      // Given
      const template = {
        'name.$': '$.user.name',
      };
      const input = {
        user: {
          name: 'Alice',
        },
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        name: 'Alice',
      });
    });

    it('returns undefined for a missing input path while still renaming the key', () => {
      // Given
      const template = {
        'missing.$': '$.user.nickname',
      };
      const input = {
        user: {
          name: 'Alice',
        },
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        missing: undefined,
      });
    });
  });

  describe('context path resolution', () => {
    it('resolves values from the Step Functions context object', () => {
      // Given
      const template = {
        'execId.$': '$$.Execution.Id',
      };
      // When
      const result = replacePathTemplateFields(template, {}, awsContext);
      // Then
      expect(result).toStrictEqual({
        execId: 'arn:aws:states:us-east-1:123456789012:execution:MyStateMachine:exec-abc-123',
      });
    });
  });

  describe('intrinsic functions', () => {
    it('evaluates intrinsic functions before assigning the renamed key', () => {
      // Given
      const template = {
        'greeting.$': "States.Format('Hello {}', $.name)",
      };
      const input = {
        name: 'Alice',
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        greeting: 'Hello Alice',
      });
    });

    it('throws when a template path expression is not a string', () => {
      // Given
      const template = {
        'broken.$': 123,
      };
      // When / Then
      expect(() => replacePathTemplateFields(template, {}, awsContext)).toThrow(
        /JSON Path should be a string/
      );
    });
  });

  describe('nested objects', () => {
    it('replaces nested template fields deeply without affecting sibling keys', () => {
      // Given
      const template = {
        outer: {
          'inner.$': '$.val',
          sibling: 'keep-me',
        },
      };
      const input = {
        val: 42,
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        outer: {
          inner: 42,
          sibling: 'keep-me',
        },
      });
    });
  });

  describe('mixed keys', () => {
    it('preserves static keys while resolving dynamic template keys', () => {
      // Given
      const template = {
        static: 'unchanged',
        'dynamic.$': '$.x',
      };
      const input = {
        x: 'resolved',
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        static: 'unchanged',
        dynamic: 'resolved',
      });
    });
  });

  describe('templates without path fields', () => {
    it('passes through objects with no .$ keys unchanged', () => {
      // Given
      const template = {
        a: 1,
        b: 2,
      };
      // When
      const result = replacePathTemplateFields(template, {}, awsContext);
      // Then
      expect(result).toStrictEqual({
        a: 1,
        b: 2,
      });
    });
  });

  describe('array values', () => {
    it('assigns arrays returned from path selection without modification', () => {
      // Given
      const template = {
        'arr.$': '$.items',
      };
      const input = {
        items: ['first', 'second', { nested: true }],
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        arr: ['first', 'second', { nested: true }],
      });
    });
  });

  describe('multiple template keys', () => {
    it('resolves multiple .$ keys in the same object', () => {
      // Given
      const template = {
        'a.$': '$.x',
        'b.$': '$.y',
      };
      const input = {
        x: 'value-x',
        y: 'value-y',
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        a: 'value-x',
        b: 'value-y',
      });
    });
  });

  describe('immutability', () => {
    it('does not mutate the original template object', () => {
      // Given
      const template = {
        static: 'unchanged',
        nested: {
          'value.$': '$.answer',
        },
      };
      const input = {
        answer: 99,
      };
      // When
      const result = replacePathTemplateFields(template, input, awsContext);
      // Then
      expect(result).toStrictEqual({
        static: 'unchanged',
        nested: {
          value: 99,
        },
      });
      expect(template).toStrictEqual({
        static: 'unchanged',
        nested: {
          'value.$': '$.answer',
        },
      });
    });
  });
});