import type {
  Operator,
  TopLevelChoiceRule,
  ChoiceOperators,
  Context,
  StateData,
} from '../../types';
import { selectPath } from '../utils/selectPath';
import Debug from 'debug';
const debug = Debug('tiny-asl-machine:operator');

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function isValidRfc3339TimestampString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = value.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]+))?(Z|[+-]([0-9]{2}):([0-9]{2}))$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? undefined : Number(match[9]);
  const offsetMinute = match[10] === undefined ? undefined : Number(match[10]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;
  if (offsetHour !== undefined && (offsetHour < 0 || offsetHour > 23)) return false;
  if (offsetMinute !== undefined && (offsetMinute < 0 || offsetMinute > 59)) return false;
  return true;
}

export function processChoices(context: Context, choices: TopLevelChoiceRule[], input: StateData) {
  const operatorKeys = Object.keys(Operators) as Operator[];
  for (const choice of choices) {
    for (const key of operatorKeys) {
      if (key in choice && key in Operators) {
        const operator = Operators[key];
        const evaluated = operator(context, input, choice);
        debug(`Operator (${key}) for choice`, choice, `evaluated to (${evaluated})`);
        if (evaluated) {
          return choice.Next;
        } else {
          break;
        }
      }
    }
  }
}

export const Operators: ChoiceOperators = {
  And: (context, input, choice) => {
    if ('And' in choice && typeof choice.And !== 'undefined') {
      const choices = choice.And;
      for (const nestedChoice of choices) {
        if (!processChoices(context, [{ Next: choice.Next, ...nestedChoice }], input)) {
          return;
        }
      }
      return choice.Next;
    }
  },
  Or: (context, input, choice) => {
    if ('Or' in choice && typeof choice.Or !== 'undefined') {
      const choices = choice.Or;
      for (const nestedChoice of choices) {
        if (processChoices(context, [{ Next: choice.Next, ...nestedChoice }], input)) {
          return choice.Next;
        }
      }
    }
  },
  Not: (context, input, choice) => {
    if ('Not' in choice && typeof choice.Not !== 'undefined') {
      const value = choice.Not;
      if (!processChoices(context, [{ Next: choice.Next, ...value }], input)) {
        return choice.Next;
      }
      return;
    }
  },
  StringEquals: (context, input, choice) => {
    if ('StringEquals' in choice && typeof choice.StringEquals !== 'undefined') {
      const value = choice.StringEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable === value;
    }
  },
  NumericEquals: (context, input, choice) => {
    if ('NumericEquals' in choice && typeof choice.NumericEquals !== 'undefined') {
      const value = choice.NumericEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable === value;
    }
  },
  NumericGreaterThanEquals: (context, input, choice) => {
    if (
      'NumericGreaterThanEquals' in choice &&
      typeof choice.NumericGreaterThanEquals !== 'undefined'
    ) {
      const value = choice.NumericGreaterThanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable >= value;
    }
  },
  NumericLessThan: (context, input, choice) => {
    if ('NumericLessThan' in choice && typeof choice.NumericLessThan !== 'undefined') {
      const value = choice.NumericLessThan;
      const variable = selectPath(choice.Variable, input, context);
      return variable < value;
    }
  },
  IsNull: (context, input, choice) => {
    if ('IsNull' in choice && typeof choice.IsNull !== 'undefined') {
      const value = choice.IsNull;
      const variable = selectPath(choice.Variable, input, context);
      const result = variable === null;
      return value ? result : !result;
    }
  },
  IsPresent: (context, input, choice) => {
    if ('IsPresent' in choice && typeof choice.IsPresent !== 'undefined') {
      const value = choice.IsPresent;
      const variable = selectPath(choice.Variable, input, context);
      const result = typeof variable !== 'undefined';
      return value ? result : !result;
    }
  },
  IsNumeric: (context, input, choice) => {
    if ('IsNumeric' in choice && typeof choice.IsNumeric !== 'undefined') {
      const value = choice.IsNumeric;
      const variable = selectPath(choice.Variable, input, context);
      const result = typeof variable === 'number';
      return value ? result : !result;
    }
  },
  IsString: (context, input, choice) => {
    if ('IsString' in choice && typeof choice.IsString !== 'undefined') {
      const value = choice.IsString;
      const variable = selectPath(choice.Variable, input, context);
      const result = typeof variable === 'string';
      return value ? result : !result;
    }
  },
  IsBoolean: (context, input, choice) => {
    if ('IsBoolean' in choice && typeof choice.IsBoolean !== 'undefined') {
      const value = choice.IsBoolean;
      const variable = selectPath(choice.Variable, input, context);
      const result = typeof variable === 'boolean';
      return value ? result : !result;
    }
  },
  IsTimestamp: (context, input, choice) => {
    if ('IsTimestamp' in choice && typeof choice.IsTimestamp !== 'undefined') {
      const value = choice.IsTimestamp;
      const variable = selectPath(choice.Variable, input, context);
      const result = isValidRfc3339TimestampString(variable);
      return value ? result : !result;
    }
  },
  StringLessThan: (context, input, choice) => {
    if ('StringLessThan' in choice && typeof choice.StringLessThan !== 'undefined') {
      const value = choice.StringLessThan;
      const variable = selectPath(choice.Variable, input, context);
      return variable < value;
    }
  },
  StringGreaterThan: (context, input, choice) => {
    if ('StringGreaterThan' in choice && typeof choice.StringGreaterThan !== 'undefined') {
      const value = choice.StringGreaterThan;
      const variable = selectPath(choice.Variable, input, context);
      return variable > value;
    }
  },
  StringLessThanEquals: (context, input, choice) => {
    if ('StringLessThanEquals' in choice && typeof choice.StringLessThanEquals !== 'undefined') {
      const value = choice.StringLessThanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable <= value;
    }
  },
  StringGreaterThanEquals: (context, input, choice) => {
    if (
      'StringGreaterThanEquals' in choice &&
      typeof choice.StringGreaterThanEquals !== 'undefined'
    ) {
      const value = choice.StringGreaterThanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable >= value;
    }
  },
  StringMatches: (context, input, choice) => {
    if ('StringMatches' in choice && typeof choice.StringMatches !== 'undefined') {
      const value = choice.StringMatches;
      const variable = selectPath(choice.Variable, input, context);
      return stringMatches(variable, value);
    }
  },
  NumericGreaterThan: (context, input, choice) => {
    if ('NumericGreaterThan' in choice && typeof choice.NumericGreaterThan !== 'undefined') {
      const value = choice.NumericGreaterThan;
      const variable = selectPath(choice.Variable, input, context);
      return variable > value;
    }
  },
  NumericLessThanEquals: (context, input, choice) => {
    if ('NumericLessThanEquals' in choice && typeof choice.NumericLessThanEquals !== 'undefined') {
      const value = choice.NumericLessThanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable <= value;
    }
  },
  NumericEqualsPath: (context, input, choice) => {
    if ('NumericEqualsPath' in choice && typeof choice.NumericEqualsPath !== 'undefined') {
      const value = selectPath(choice.NumericEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return variable === value;
    }
  },
  NumericLessThanPath: (context, input, choice) => {
    if ('NumericLessThanPath' in choice && typeof choice.NumericLessThanPath !== 'undefined') {
      const value = selectPath(choice.NumericLessThanPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return variable < value;
    }
  },
  NumericGreaterThanPath: (context, input, choice) => {
    if (
      'NumericGreaterThanPath' in choice &&
      typeof choice.NumericGreaterThanPath !== 'undefined'
    ) {
      const value = selectPath(choice.NumericGreaterThanPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return variable > value;
    }
  },
  NumericLessThanEqualsPath: (context, input, choice) => {
    if (
      'NumericLessThanEqualsPath' in choice &&
      typeof choice.NumericLessThanEqualsPath !== 'undefined'
    ) {
      const value = selectPath(choice.NumericLessThanEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return variable <= value;
    }
  },
  NumericGreaterThanEqualsPath: (context, input, choice) => {
    if (
      'NumericGreaterThanEqualsPath' in choice &&
      typeof choice.NumericGreaterThanEqualsPath !== 'undefined'
    ) {
      const value = selectPath(choice.NumericGreaterThanEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return variable >= value;
    }
  },
  BooleanEquals: (context, input, choice) => {
    if ('BooleanEquals' in choice && typeof choice.BooleanEquals !== 'undefined') {
      const value = choice.BooleanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return variable === value;
    }
  },
  BooleanEqualsPath: (context, input, choice) => {
    if ('BooleanEqualsPath' in choice && typeof choice.BooleanEqualsPath !== 'undefined') {
      const value = selectPath(choice.BooleanEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return variable === value;
    }
  },
  TimestampEquals: (context, input, choice) => {
    if ('TimestampEquals' in choice && typeof choice.TimestampEquals !== 'undefined') {
      const value = choice.TimestampEquals;
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) === Date.parse(value);
    }
  },
  TimestampLessThan: (context, input, choice) => {
    if ('TimestampLessThan' in choice && typeof choice.TimestampLessThan !== 'undefined') {
      const value = choice.TimestampLessThan;
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) < Date.parse(value);
    }
  },
  TimestampGreaterThan: (context, input, choice) => {
    if ('TimestampGreaterThan' in choice && typeof choice.TimestampGreaterThan !== 'undefined') {
      const value = choice.TimestampGreaterThan;
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) > Date.parse(value);
    }
  },
  TimestampLessThanEquals: (context, input, choice) => {
    if (
      'TimestampLessThanEquals' in choice &&
      typeof choice.TimestampLessThanEquals !== 'undefined'
    ) {
      const value = choice.TimestampLessThanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) <= Date.parse(value);
    }
  },
  TimestampGreaterThanEquals: (context, input, choice) => {
    if (
      'TimestampGreaterThanEquals' in choice &&
      typeof choice.TimestampGreaterThanEquals !== 'undefined'
    ) {
      const value = choice.TimestampGreaterThanEquals;
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) >= Date.parse(value);
    }
  },
  TimestampEqualsPath: (context, input, choice) => {
    if ('TimestampEqualsPath' in choice && typeof choice.TimestampEqualsPath !== 'undefined') {
      const value = selectPath(choice.TimestampEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) === Date.parse(value);
    }
  },
  TimestampLessThanPath: (context, input, choice) => {
    if ('TimestampLessThanPath' in choice && typeof choice.TimestampLessThanPath !== 'undefined') {
      const value = selectPath(choice.TimestampLessThanPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) < Date.parse(value);
    }
  },
  TimestampGreaterThanPath: (context, input, choice) => {
    if (
      'TimestampGreaterThanPath' in choice &&
      typeof choice.TimestampGreaterThanPath !== 'undefined'
    ) {
      const value = selectPath(choice.TimestampGreaterThanPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) > Date.parse(value);
    }
  },
  TimestampLessThanEqualsPath: (context, input, choice) => {
    if (
      'TimestampLessThanEqualsPath' in choice &&
      typeof choice.TimestampLessThanEqualsPath !== 'undefined'
    ) {
      const value = selectPath(choice.TimestampLessThanEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) <= Date.parse(value);
    }
  },
  TimestampGreaterThanEqualsPath: (context, input, choice) => {
    if (
      'TimestampGreaterThanEqualsPath' in choice &&
      typeof choice.TimestampGreaterThanEqualsPath !== 'undefined'
    ) {
      const value = selectPath(choice.TimestampGreaterThanEqualsPath, input, context);
      const variable = selectPath(choice.Variable, input, context);
      return Date.parse(variable) >= Date.parse(value);
    }
  },
};

const stringMatches = (value: string, rule: string): boolean => {
  const escapeRegex = (str: string) => str.replace(/[-/^$*+?.()|[]{}]/g, '\\$&');
  const replaceAsterisk = (str: string) =>
    str
      .split(/(?<!(?:\\))\*/g)
      .map(escapeRegex)
      .join('.*');
  const testMask = rule.split(/\\\\/).map(replaceAsterisk).join('\\\\');
  return new RegExp(`^${testMask}$`).test(value);
};
