import { json } from '../_lib/response';
import { getEnvString, type CloudflarePagesContext } from '../_lib/runtime';

export function onRequestGet(context: CloudflarePagesContext) {
  return json({
    hasContextEnv: Boolean(context.env),
    hasVolcengineApiKey: Boolean(getEnvString(context, 'VOLCENGINE_API_KEY')),
    hasArkApiKey: Boolean(getEnvString(context, 'ARK_API_KEY')),
    hasModelId: Boolean(getEnvString(context, 'VOLCENGINE_MODEL_ID')),
    hasAccessKeyId: Boolean(getEnvString(context, 'VOLCENGINE_ACCESS_KEY_ID')),
    hasSecretAccessKey: Boolean(getEnvString(context, 'VOLCENGINE_SECRET_ACCESS_KEY')),
    bindingKeys: context.env ? Object.keys(context.env).sort() : [],
  });
}
