import { buildSentryOptions } from "./sentry.options";

const options = buildSentryOptions("client");

export default options;
export { options as clientSentryOptions };
