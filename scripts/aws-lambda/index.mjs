/* eslint-env node */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  SFNClient,
  SendTaskFailureCommand,
  SendTaskHeartbeatCommand,
  SendTaskSuccessCommand,
} from '@aws-sdk/client-sfn';
import { S3Client, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const aws = {
  lambda: {
    LambdaClient,
    InvokeCommand,
  },
  s3: {
    S3Client,
    HeadBucketCommand,
    PutObjectCommand,
  },
  sfn: {
    SFNClient,
    SendTaskSuccessCommand,
    SendTaskFailureCommand,
    SendTaskHeartbeatCommand,
  },
  sts: {
    STSClient,
    GetCallerIdentityCommand,
  },
};

export const handler = async (event = {}, context) => {
  const config = normalizeConfig(event.config);
  const payload = Object.prototype.hasOwnProperty.call(event, 'payload') ? event.payload : event;
  const taskToken = getTaskToken(event);

  maybeLogEvent(config, event, payload, taskToken);

  const executeScript = new AsyncFunction(
    'config',
    'event',
    'payload',
    'taskToken',
    'context',
    'env',
    'aws',
    `"use strict";\n${config.script}`
  );

  return await executeScript(config, event, payload, taskToken, context, process.env, aws);
};

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('event.config must be an object.');
  }

  if (typeof config.script !== 'string' || config.script.trim().length === 0) {
    throw new Error('event.config.script must be a non-empty string.');
  }

  return config;
}

function getTaskToken(event) {
  if (typeof event?.taskToken === 'string' && event.taskToken.length > 0) {
    return event.taskToken;
  }

  if (typeof event?.Task?.Token === 'string' && event.Task.Token.length > 0) {
    return event.Task.Token;
  }

  return undefined;
}

function maybeLogEvent(config, event, payload, taskToken) {
  if (config.logEvent === true) {
    console.log({ event, payload, taskToken });
  }

  if (Array.isArray(config.logEnvKeys) && config.logEnvKeys.length > 0) {
    const selectedEnv = Object.fromEntries(
      config.logEnvKeys.filter(key => typeof key === 'string').map(key => [key, process.env[key]])
    );
    console.log({ env: selectedEnv });
  }
}
