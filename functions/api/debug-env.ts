import { json } from '../_lib/response';
import { getEnvString, type CloudflarePagesContext } from '../_lib/runtime';

function describeBinding(value: unknown) {
  if (value === null) {
    return { type: 'null' };
  }

  if (value === undefined) {
    return { type: 'undefined' };
  }

  if (typeof value === 'string') {
    return { type: 'string', length: value.length };
  }

  if (typeof value === 'object') {
    return { type: 'object', keys: Object.keys(value as Record<string, unknown>).sort() };
  }

  return { type: typeof value };
}

export function onRequestGet(context: CloudflarePagesContext) {
  return json({
    hasContextEnv: Boolean(context.env),
    hasVolcengineApiKey: Boolean(getEnvString(context, 'VOLCENGINE_API_KEY')),
    hasArkApiKey: Boolean(getEnvString(context, 'ARK_API_KEY')),
    hasModelId: Boolean(getEnvString(context, 'VOLCENGINE_MODEL_ID')),
    hasAccessKeyId: Boolean(getEnvString(context, 'VOLCENGINE_ACCESS_KEY_ID')),
    hasReqKey: Boolean(getEnvString(context, 'VOLCENGINE_REQ_KEY')),
    hasSecretAccessKey: Boolean(getEnvString(context, 'VOLCENGINE_SECRET_ACCESS_KEY')),
    bindingKeys: context.env ? Object.keys(context.env).sort() : [],
    bindingShapes: {
      VOLCENGINE_ACCESS_KEY_ID: describeBinding(context.env?.VOLCENGINE_ACCESS_KEY_ID),
      VOLCENGINE_REQ_KEY: describeBinding(context.env?.VOLCENGINE_REQ_KEY),
      VOLCENGINE_SECRET_ACCESS_KEY: describeBinding(context.env?.VOLCENGINE_SECRET_ACCESS_KEY),
      VOLCENGINE_API_KEY: describeBinding(context.env?.VOLCENGINE_API_KEY),
      ARK_API_KEY: describeBinding(context.env?.ARK_API_KEY),
      VOLCENGINE_MODEL_ID: describeBinding(context.env?.VOLCENGINE_MODEL_ID),
    },
  });
}
